import { Queue, Worker, Job } from "bullmq";
import { getRedisConnectionOptions, isRedisLuaError } from "../redis";
import { logger } from "../utils/logger";
import { logger as slog } from "../utils/logger";

export const QUEUE_NAMES = {
  WA_INIT: "wa-initSession",
  WA_CLEANUP: "wa-cleanup",
  WA_SYNC_GROUPS: "wa-sync-groups",
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
        defaultJobOptions: {
          removeOnComplete: { count: 500 },
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
        },
      });
      queues.set(name, q);
    } catch (e) {
      logger.warn("BULLMQ", `Falha ao criar fila ${name}`, e);
      return null;
    }
  }
  return q;
}

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
      logger.warn("BULLMQ", "Redis 5.x (erro Lua). Use Redis 6.2+. Fallback em processo.");
      return { ok: false, luaError: true };
    }
    logger.error("BULLMQ", "Erro ao enfileirar", e);
    return { ok: false };
  }
}

export function getSyncGroupsQueue(): Queue | null {
  return getQueue(QUEUE_NAMES.WA_SYNC_GROUPS);
}

export function getInitQueue(): Queue | null {
  return getQueue(QUEUE_NAMES.WA_INIT);
}

export function getCleanupQueue(): Queue | null {
  return getQueue(QUEUE_NAMES.WA_CLEANUP);
}

const SYNC_POLL_MS = 800;
const SYNC_TIMEOUT_MS = 130000;

export async function addSyncGroupsJobAndWait(companyId: string): Promise<unknown> {
  const queue = getSyncGroupsQueue();
  if (!queue) {
    logger.error("SYNC", "Fila wa-sync-groups indisponivel (Redis?)");
    throw new Error("Sincronização indisponível. Redis/filas não configurados.");
  }
  const jobId = `sync-${companyId}-${Date.now()}`;
  const job = await queue.add("sync", { companyId }, { jobId });
  slog.info("SYNC", "Job sync enfileirado", { companyId, jobId: job.id });
  const deadline = Date.now() + SYNC_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, SYNC_POLL_MS));
    const j = await queue.getJob(job.id!);
    if (!j) continue;
    const state = await j.getState();
    if (state === "completed") {
      slog.info("SYNC", "Job sync concluido", { companyId, jobId: job.id, durationMs: Date.now() - (deadline - SYNC_TIMEOUT_MS) });
      return j.returnvalue;
    }
    if (state === "failed") {
      const reason = String(j.failedReason ?? "Sincronização falhou");
      slog.error("SYNC", "Job sync falhou", { companyId, jobId: job.id, reason });
      throw new Error(reason);
    }
  }
  slog.error("SYNC", "Job sync timeout", { companyId, jobId: job.id });
  throw new Error("Sincronização em tempo limite. Tente novamente.");
}

/** 1 = um sync por vez (menos CPU, evita travar). Ajuste via SYNC_CONCURRENCY no .env se precisar. */
const GLOBAL_SYNC_CONCURRENCY = Math.max(1, Math.min(5, Number(process.env.SYNC_CONCURRENCY || 1)));
const INIT_CONCURRENCY = Math.max(1, Math.min(4, Number(process.env.INIT_CONCURRENCY || 1)));
const CLEANUP_CONCURRENCY = 2;

export function startWhatsAppQueueWorkers(handlers: {
  restart: (sessionId: string, companyId: string) => Promise<unknown>;
  ensure?: (sessionId: string) => Promise<unknown>;
  disconnect: (sessionId: string, companyId: string) => Promise<unknown>;
  release: (sessionId: string, companyId: string) => Promise<unknown>;
  syncGroups?: (companyId: string) => Promise<unknown>;
}): void {
  const conn = getConnection();
  if (!conn) return;
  try {
    if (handlers.syncGroups) {
      const syncWorker = new Worker(
        QUEUE_NAMES.WA_SYNC_GROUPS,
        async (job: Job) => {
          const { companyId } = job.data as { companyId: string };
          if (!companyId) {
            slog.warn("SYNC", "Job sem companyId", { jobId: job.id });
            return null;
          }
          const ctx = { companyId, jobId: String(job.id) };
          const start = Date.now();
          try {
            const result = await handlers.syncGroups!(companyId);
            slog.info("SYNC", "Job sync concluido", { ...ctx, durationMs: Date.now() - start });
            return result;
          } catch (err) {
            slog.error("SYNC", "Job sync erro", { ...ctx, durationMs: Date.now() - start, err });
            throw err;
          }
        },
        { connection: conn, concurrency: GLOBAL_SYNC_CONCURRENCY }
      );
      syncWorker.on("failed", (j, err) => slog.error("SYNC", "Job wa-sync-groups falhou", { jobId: j?.id, err }));
      workers.push(syncWorker);
    }

    const initWorker = new Worker(
      QUEUE_NAMES.WA_INIT,
      async (job: Job) => {
        const { sessionId, companyId } = job.data as { sessionId: string; companyId: string };
        if (!sessionId) return;
        if (job.name === "restart" && companyId) await handlers.restart(sessionId, companyId);
        else if (job.name === "ensure" && handlers.ensure) await handlers.ensure(sessionId);
      },
      { connection: conn, concurrency: INIT_CONCURRENCY }
    );
    initWorker.on("failed", (j, err) => logger.error("BULLMQ", `Job wa-init ${j?.name} falhou`, err));
    workers.push(initWorker);

    const cleanupWorker = new Worker(
      QUEUE_NAMES.WA_CLEANUP,
      async (job: Job) => {
        const { sessionId, companyId } = job.data as { sessionId: string; companyId: string };
        if (!sessionId || !companyId) return;
        if (job.name === "disconnect") await handlers.disconnect(sessionId, companyId);
        else if (job.name === "release") await handlers.release(sessionId, companyId);
      },
      { connection: conn, concurrency: CLEANUP_CONCURRENCY }
    );
    cleanupWorker.on("failed", (j, err) => logger.error("BULLMQ", `Job wa-cleanup ${j?.name} falhou`, err));
    workers.push(cleanupWorker);

    logger.info("BULLMQ", "Workers WhatsApp (init/cleanup/sync) iniciados");
  } catch (e) {
    logger.warn("BULLMQ", "Falha ao iniciar workers WhatsApp", e);
  }
}

export async function closeWhatsAppWorkers(): Promise<void> {
  for (const w of workers) await w.close().catch(() => {});
  workers.length = 0;
}
