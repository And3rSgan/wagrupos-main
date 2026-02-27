/**
 * Envia uma campanha para todos os alvos.
 * Usado por POST /campaigns/:id/send e pelo cron de agendamento.
 * Respeita delay e lote configurados em Configurações > Disparos.
 */
import { prisma } from "../prismaClient";
import { sendMessageToGroup } from "./whatsappService";
import { generateMessage } from "./messageGeneratorService";
import { assertCampaignsPerDay } from "./planLimitsService";
import { getResolvedDispatchSettings } from "./dispatchSettingsService";
import { emitCampaignUpdated } from "../socketIo";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Tenta carregar a campanha com retry (evita FK quando worker roda em outro processo/replica com lag). */
async function findCampaignWithRetry(campaignId: string, userId: string, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      include: {
        user: { select: { companyId: true } },
        targets: { include: { group: { include: { session: { select: { companyId: true } } } } } },
        product: true,
        template: true,
      },
    });
    if (campaign && campaign.userId === userId) return campaign;
    if (attempt < maxAttempts) await sleep(500 * attempt);
  }
  return null;
}

export async function sendCampaign(campaignId: string, userId: string): Promise<void> {
  const campaign = await findCampaignWithRetry(campaignId, userId);

  if (!campaign || campaign.userId !== userId) {
    throw new Error("Campanha não encontrada");
  }

  let companyId = campaign.user.companyId;
  if (!companyId && campaign.user) {
    const u = await prisma.user.findUnique({
      where: { id: campaign.userId },
      select: { role: true },
    });
    if (u?.role === "SUPERADMIN") {
      const sist = await prisma.company.findFirst({
        where: { slug: "sistema-administrativo" },
        select: { id: true },
      });
      if (sist) companyId = sist.id;
    }
  }
  if (!companyId) {
    throw new Error("Usuário deve estar vinculado a uma empresa para enviar campanhas.");
  }

  await assertCampaignsPerDay(companyId);

  const dispatch = await getResolvedDispatchSettings(companyId);
  const product = campaign.product;
  const template = campaign.template;
  const useGenerator = template && product;
  const linkUrl = campaign.linkUrl || product?.link || undefined;

  for (let i = 0; i < campaign.targets.length; i++) {
    const t = campaign.targets[i];
    const delaySec = randomBetween(dispatch.delayMinSec, dispatch.delayMaxSec);
    await sleep(delaySec * 1000);

    const productData = product
      ? {
          title: product.title,
          price: product.price,
          oldPrice: product.oldPrice ?? undefined,
          discountPercent: product.discountPercent ?? undefined,
          coupon: product.coupon ?? undefined,
          link: product.link ?? undefined,
          store: product.store ?? undefined,
          category: product.category ?? undefined,
        }
      : null;
    const msg = useGenerator
      ? generateMessage(template!.body, productData, i + Date.now())
      : campaign.messageText;
    await sendMessageToGroup(companyId, t.groupId, msg, campaign.imagePath ?? undefined, {
      campaignId: campaign.id,
      linkUrl: linkUrl ?? undefined,
      userId,
      mentionAll: campaign.mentionAll ?? false,
    });

    const sentInBatch = (i + 1) % dispatch.batchSize === 0;
    if (sentInBatch && i < campaign.targets.length - 1 && dispatch.pauseBetweenBatchesSec > 0) {
      await sleep(dispatch.pauseBetweenBatchesSec * 1000);
    }
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "sent", sentAt: new Date() },
  });

  const repeatRule = campaign.repeatRule ?? null;
  const repeatWeekdays = campaign.repeatWeekdays;
  const baseDate = campaign.scheduledAt ? new Date(campaign.scheduledAt) : new Date();

  if (repeatRule === "daily") {
    const next = new Date(baseDate);
    next.setDate(next.getDate() + 1);
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { scheduledAt: next, status: "queued", errorMessage: null },
    });
  } else if (repeatRule === "weekly") {
    const next = new Date(baseDate);
    next.setDate(next.getDate() + 7);
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { scheduledAt: next, status: "queued", errorMessage: null },
    });
  } else if (repeatRule === "weekdays" && repeatWeekdays) {
    let weekdays: number[];
    try {
      weekdays = JSON.parse(repeatWeekdays) as number[];
    } catch {
      weekdays = [];
    }
    if (weekdays.length > 0) {
      const baseHours = baseDate.getHours();
      const baseMinutes = baseDate.getMinutes();
      const baseSeconds = baseDate.getSeconds();
      let next = new Date(baseDate);
      next.setDate(next.getDate() + 1);
      for (let i = 0; i < 8; i++) {
        if (weekdays.includes(next.getDay())) {
          next.setHours(baseHours, baseMinutes, baseSeconds, 0);
          await prisma.campaign.update({
            where: { id: campaign.id },
            data: { scheduledAt: next, status: "queued", errorMessage: null },
          });
          break;
        }
        next.setDate(next.getDate() + 1);
      }
    }
  }

  emitCampaignUpdated(companyId);
}

/** Reenvia apenas para grupos cujo envio falhou (status failed). */
export async function resendCampaignFailed(campaignId: string, userId: string): Promise<void> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
    include: {
      user: { select: { companyId: true } },
      product: true,
      template: true,
    },
  });
  if (!campaign || campaign.userId !== userId) throw new Error("Campanha não encontrada");

  let companyId = campaign.user?.companyId;
  if (!companyId) {
    const u = await prisma.user.findUnique({ where: { id: campaign.userId }, select: { role: true } });
    if (u?.role === "SUPERADMIN") {
      const sist = await prisma.company.findFirst({
        where: { slug: "sistema-administrativo" },
        select: { id: true },
      });
      if (sist) companyId = sist.id;
    }
  }
  if (!companyId) throw new Error("Usuário deve estar vinculado a uma empresa.");

  const failedSends = await prisma.messageSend.findMany({
    where: { campaignId, status: "failed" },
    include: { group: true },
  });
  if (failedSends.length === 0) {
    return;
  }

  const dispatch = await getResolvedDispatchSettings(companyId);
  const linkUrl = campaign.linkUrl || campaign.product?.link || undefined;
  const useGenerator = Boolean(campaign.template && campaign.product);

  for (let i = 0; i < failedSends.length; i++) {
    const send = failedSends[i];
    const delaySec = randomBetween(dispatch.delayMinSec, dispatch.delayMaxSec);
    await sleep(delaySec * 1000);

    const productData = campaign.product
      ? {
          title: campaign.product.title,
          price: campaign.product.price,
          oldPrice: campaign.product.oldPrice ?? undefined,
          discountPercent: campaign.product.discountPercent ?? undefined,
          coupon: campaign.product.coupon ?? undefined,
          link: campaign.product.link ?? undefined,
          store: campaign.product.store ?? undefined,
          category: campaign.product.category ?? undefined,
        }
      : null;
    const msg = useGenerator && campaign.template && campaign.product
      ? generateMessage(campaign.template.body, productData, i + Date.now())
      : campaign.messageText;

    await sendMessageToGroup(companyId, send.groupId, msg, campaign.imagePath ?? undefined, {
      campaignId: campaign.id,
      linkUrl: linkUrl ?? undefined,
      userId,
      mentionAll: campaign.mentionAll ?? false,
    });
  }
  emitCampaignUpdated(companyId);
}
