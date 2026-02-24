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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function sendCampaign(campaignId: string, userId: string): Promise<void> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
    include: {
      user: { select: { companyId: true } },
      targets: { include: { group: { include: { session: { select: { companyId: true } } } } } },
      product: true,
      template: true,
    },
  });

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
}
