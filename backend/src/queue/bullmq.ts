/**
 * BullMQ: filas com nomes em hífen (sem :), conexão Redis estável.
 * Fallback em processo quando Redis 5.x retorna erro de Lua.
 */
import { Queue, Worker, Job } from "bullmq";
import { getRedisConnectionOptions, isRedisLuaError } from "../redis";
import { logger } from "../utils/logger";

const QUEUE_NAMES = {
  WA_INIT: "wa-initSession",
  WA_CLEANUP: "wa-cleanup",
  CAMPAIGNS: "campaigns-processScheduled",
  INVOICES_MONTHLY: "invoices-monthly",
  INVOICES_OVERDUE: "invoices-overdue",
} as const;

type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

let connection: { host: string; port: number; password?: string; db?: number } | null = null;
const queues = new Map<string, Queue>();
const workers: Worker[] = [];

function getConnection() {
  if (connection) return connection;
  connection = getRedisConnectionOptions();
  return connection;
}

function getQueue(name: QueueName): Queue | null {
  const conn = getConnection();
  if (!conn) return null;
  let q = queues.get(name);
  if (!q) {
    try {
      q = new Queue(name, {
        connection: conn,
        defaultJobOptions: { removeOnComplete: { count: 500 }, attempts: 2, backoff: { type: "exponential", delay: 1000 } },
      });
      queues.set(name, q);
    } catch (e) {
      logger.warn("BULLMQ", `Falha ao criar fila ${name}`, e);
      return null;
    }
  }
  return q;
}

/** Adiciona job à fila. Retorna { ok: true } ou { ok: false, luaError: true } para fallback. */
export async function addJobSafe(
  queueName: QueueName,
  jobName: string,
  data: Record<string, unknown>
): Promise<{ ok: boolean; luaError?: boolean }> {
  const queue = getQueue(queueName);
  if (!queue) return { ok: false };
  try {
    await queue.add(jobName, data);
    return { ok: true };
  } catch (e) {
    if (isRedisLuaError(e)) {
      logger.warn("BULLMQ", "Redis 5.x detectado (erro Lua). Use Redis 6.2+ para filas. Fallback em processo.");
      return { ok: false, luaError: true };
    }
    logger.error("BULLMQ", "Erro ao enfileirar", e);
    return { ok: false };
  }
}

export function getCleanupQueue(): Queue | null {
  return getQueue(QUEUE_NAMES.WA_CLEANUP);
}

export function getInitQueue(): Queue | null {
  return getQueue(QUEUE_NAMES.WA_INIT);
}

export { QUEUE_NAMES };

/** Processadores pesados: campanhas, faturas. Workers só rodam se Redis estiver ok. */
export function startBullMQWorkers(handlers: {
  processScheduledCampaigns: () => Promise<void>;
  generateMonthlyInvoices: () => Promise<void>;
  markOverdueInvoices: () => Promise<void>;
}): void {
  const conn = getConnection();
  if (!conn) return;

  try {
    const wCampaigns = new Worker(
      QUEUE_NAMES.CAMPAIGNS,
      async (_job: Job) => {
        await handlers.processScheduledCampaigns();
      },
      { connection: conn, concurrency: 1 }
    );
    wCampaigns.on("failed", (j, err) => logger.error("BULLMQ", `Job ${j?.name} falhou`, err));
    workers.push(wCampaigns);

    const wMonthly = new Worker(
      QUEUE_NAMES.INVOICES_MONTHLY,
      async (job) => {
        if (job.name === "run") await handlers.generateMonthlyInvoices();
      },
      { connection: conn, concurrency: 1 }
    );
    wMonthly.on("failed", (j, err) => logger.error("BULLMQ", `Job ${j?.name} falhou`, err));
    workers.push(wMonthly);

    const wOverdue = new Worker(
      QUEUE_NAMES.INVOICES_OVERDUE,
      async (job) => {
        if (job.name === "run") await handlers.markOverdueInvoices();
      },
      { connection: conn, concurrency: 1 }
    );
    wOverdue.on("failed", (j, err) => logger.error("BULLMQ", `Job ${j?.name} falhou`, err));
    workers.push(wOverdue);

    logger.info("BULLMQ", "Workers BullMQ iniciados (campanhas, faturas)");
  } catch (e) {
    logger.warn("BULLMQ", "Falha ao iniciar workers", e);
  }
}

/** Workers para restart/disconnect/release de sessões WhatsApp (filas wa-initSession e wa-cleanup). */
export function startWhatsAppQueueWorkers(handlers: {
  restart: (sessionId: string, companyId: string) => Promise<unknown>;
  disconnect: (sessionId: string, companyId: string) => Promise<unknown>;
  release: (sessionId: string, companyId: string) => Promise<unknown>;
}): void {
  const conn = getConnection();
  if (!conn) return;
  try {
    const initWorker = new Worker(
      QUEUE_NAMES.WA_INIT,
      async (job) => {
        const { sessionId, companyId } = job.data as { sessionId: string; companyId: string };
        if (job.name === "restart" && sessionId && companyId) await handlers.restart(sessionId, companyId);
      },
      { connection: conn, concurrency: 2 }
    );
    initWorker.on("failed", (j, err) => logger.error("BULLMQ", `Job wa-init ${j?.name} falhou`, err));
    workers.push(initWorker);

    const cleanupWorker = new Worker(
      QUEUE_NAMES.WA_CLEANUP,
      async (job) => {
        const { sessionId, companyId } = job.data as { sessionId: string; companyId: string };
        if (!sessionId || !companyId) return;
        if (job.name === "disconnect") await handlers.disconnect(sessionId, companyId);
        else if (job.name === "release") await handlers.release(sessionId, companyId);
      },
      { connection: conn, concurrency: 2 }
    );
    cleanupWorker.on("failed", (j, err) => logger.error("BULLMQ", `Job wa-cleanup ${j?.name} falhou`, err));
    workers.push(cleanupWorker);

    logger.info("BULLMQ", "Workers WhatsApp (init/cleanup) iniciados");
  } catch (e) {
    logger.warn("BULLMQ", "Falha ao iniciar workers WhatsApp", e);
  }
}

export async function closeBullMQ(): Promise<void> {
  for (const w of workers) await w.close().catch(() => {});
  workers.length = 0;
  for (const q of queues.values()) await q.close().catch(() => {});
  queues.clear();
}
