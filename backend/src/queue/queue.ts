/**
 * Filas: BullMQ + Redis quando disponível; fallback em processo (cron) quando Redis 5.x (erro Lua).
 * Scheduler apenas enfileira; processamento pesado fica no worker.
 */
import cron from "node-cron";
import { prisma } from "../prismaClient";
import { logger } from "../utils/logger";
import { sendCampaign } from "../services/campaignSendService";
import { addJobSafe, QUEUE_NAMES, startBullMQWorkers } from "./bullmq";

export async function processScheduledCampaigns(): Promise<void> {
  const now = new Date();
  const campaigns = await prisma.campaign.findMany({
    where: {
      status: "queued",
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: "asc" },
  });

  for (const c of campaigns) {
    try {
      await sendCampaign(c.id, c.userId);

      if (c.repeatRule === "daily") {
        const next = new Date(c.scheduledAt!);
        next.setDate(next.getDate() + 1);
        await prisma.campaign.update({
          where: { id: c.id },
          data: { scheduledAt: next, status: "queued", errorMessage: null },
        });
        logger.info("QUEUE", `Campanha ${c.id} reagendada para ${next.toISOString()} (diário)`);
      } else if (c.repeatRule === "weekly") {
        const next = new Date(c.scheduledAt!);
        next.setDate(next.getDate() + 7);
        await prisma.campaign.update({
          where: { id: c.id },
          data: { scheduledAt: next, status: "queued", errorMessage: null },
        });
        logger.info("QUEUE", `Campanha ${c.id} reagendada para ${next.toISOString()} (semanal)`);
      }

      logger.success("QUEUE", `Campanha ${c.id} enviada (${c.title || "Sem título"})`);
    } catch (err: any) {
      logger.error("QUEUE", `Falha ao enviar campanha ${c.id}`, err);
      const isLimitError = err?.message?.includes("Limite diário") ?? false;
      const errorMessage = isLimitError
        ? "Limite diário de envios atingido. Reagende para amanhã e tente novamente."
        : err?.message ?? "Falha ao enviar. Reagende ou tente novamente.";
      await prisma.campaign.update({
        where: { id: c.id },
        data: { status: "failed", errorMessage },
      });
    }
  }
}

export async function generateMonthlyInvoices(): Promise<void> {
  const subs = await prisma.subscription.findMany({
    where: { status: "active" },
    include: { company: true, plan: true },
  });

  const now = new Date();
  const dueDate = new Date(now.getFullYear(), now.getMonth(), 5);

  for (const sub of subs) {
    const existing = await prisma.invoice.findFirst({
      where: {
        companyId: sub.companyId,
        subscriptionId: sub.id,
        dueDate: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
      },
    });
    if (existing) continue;

    await prisma.invoice.create({
      data: {
        companyId: sub.companyId,
        subscriptionId: sub.id,
        amount: sub.plan.price,
        status: "pending",
        dueDate,
      },
    });
    logger.info("QUEUE", `Fatura criada para ${sub.company.name}`);
  }
}

export async function markOverdueInvoices(): Promise<void> {
  const result = await prisma.invoice.updateMany({
    where: {
      status: "pending",
      dueDate: { lt: new Date() },
    },
    data: { status: "overdue" },
  });
  if (result.count > 0) {
    logger.info("QUEUE", `${result.count} fatura(s) marcada(s) como vencida`);
  }
}

/**
 * Agenda o job sem bloquear o event loop. Evita "node-cron missed execution" por IO/CPU bloqueante.
 * Se Redis estiver ok, enfileira no BullMQ. Se fallback, dispara runInProcess em background (não aguarda).
 */
function runWithFallback(
  enqueue: () => Promise<{ ok: boolean; luaError?: boolean }>,
  runInProcess: () => Promise<void>,
  logLabel: string
) {
  setImmediate(() => {
    enqueue()
      .then((result) => {
        if (result.ok) return;
        if (result.luaError) {
          logger.warn("QUEUE", `BullMQ requer Redis 6.2+. Executando ${logLabel} em processo (fallback).`);
          void runInProcess().catch((err: any) => logger.error("QUEUE", `Erro em ${logLabel}`, err));
        }
      })
      .catch((err: any) => logger.error("QUEUE", `Erro ao enfileirar ${logLabel}`, err));
  });
}

export function startQueue() {
  startBullMQWorkers({
    processScheduledCampaigns,
    generateMonthlyInvoices,
    markOverdueInvoices,
  });

  cron.schedule(
    "5 0 1 * *",
    () =>
      runWithFallback(
        () => addJobSafe(QUEUE_NAMES.INVOICES_MONTHLY, "run", {}),
        generateMonthlyInvoices,
        "faturas mensais"
      )
  );
  cron.schedule(
    "0 1 * * *",
    () =>
      runWithFallback(
        () => addJobSafe(QUEUE_NAMES.INVOICES_OVERDUE, "run", {}),
        markOverdueInvoices,
        "faturas vencidas"
      )
  );
  cron.schedule(
    "* * * * *",
    () =>
      runWithFallback(
        () => addJobSafe(QUEUE_NAMES.CAMPAIGNS, "run", {}),
        processScheduledCampaigns,
        "campanhas agendadas"
      )
  );

  logger.info("QUEUE", "Scheduler iniciado (BullMQ ou fallback em processo)");
}
