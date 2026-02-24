/**
 * Redis: conexão e session store (wa:session:*).
 * Suporta REDIS_URI ou variáveis IO_REDIS_* (Whaticket).
 */
import Redis from "ioredis";
import { env } from "./config/env";
import { logger } from "./utils/logger";

const SESSION_PREFIX = "wa:session:";
const SESSION_TTL_SEC = 86400; // 1 dia

let redisClient: Redis | null = null;

export type SessionStatus = "disconnected" | "pairing" | "qr" | "connected";

export function getRedisClient(): Redis | null {
  if (!env.redisUri) return null;
  if (redisClient) return redisClient;
  try {
    redisClient = new Redis(env.redisUri, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });
    redisClient.on("error", (err) => logger.warn("REDIS", "Redis client error", err));
    return redisClient;
  } catch (e) {
    logger.warn("REDIS", "Falha ao criar cliente Redis", e);
    return null;
  }
}

/** Retorna opções de conexão para BullMQ (objeto connection). */
export function getRedisConnectionOptions(): { host: string; port: number; password?: string; db?: number } | null {
  if (!env.redisUri) return null;
  try {
    const u = new URL(env.redisUri);
    const host = u.hostname || "127.0.0.1";
    const port = parseInt(u.port || "6379", 10);
    const password = u.password ? decodeURIComponent(u.password) : undefined;
    const db = u.pathname?.replace(/\//g, "") ? parseInt(u.pathname.replace(/\//g, ""), 10) : 0;
    if (Number.isNaN(db)) return { host, port, password };
    return { host, port, password, db: Number.isNaN(db) ? undefined : db };
  } catch {
    return null;
  }
}

/** Verifica se o erro é o de Lua/msgpack do Redis 5.x (BullMQ requer Redis 6.2+). */
export function isRedisLuaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /Lua redis\(\) command arguments must be strings or integers/i.test(msg) || /msgpack/i.test(msg);
}

/** Session store: sincroniza estado da sessão WhatsApp (qr, ready) para Redis. */
export const sessionStore = {
  async setStatus(sessionId: string, status: SessionStatus): Promise<void> {
    const client = getRedisClient();
    if (!client) return;
    const key = `${SESSION_PREFIX}${sessionId}:status`;
    try {
      await client.set(key, status, "EX", SESSION_TTL_SEC);
    } catch (e) {
      logger.warn("REDIS", `sessionStore.setStatus ${sessionId}`, e);
    }
  },

  async setQr(sessionId: string, qr: string): Promise<void> {
    const client = getRedisClient();
    if (!client) return;
    const key = `${SESSION_PREFIX}${sessionId}:qr`;
    try {
      await client.set(key, qr, "EX", 90);
    } catch (e) {
      logger.warn("REDIS", `sessionStore.setQr ${sessionId}`, e);
    }
  },

  async setMeta(sessionId: string, meta: { pushName?: string | null; phone?: string | null; wid?: string | null }): Promise<void> {
    const client = getRedisClient();
    if (!client) return;
    const key = `${SESSION_PREFIX}${sessionId}:meta`;
    try {
      await client.set(key, JSON.stringify(meta), "EX", SESSION_TTL_SEC);
    } catch (e) {
      logger.warn("REDIS", `sessionStore.setMeta ${sessionId}`, e);
    }
  },

  async clearQr(sessionId: string): Promise<void> {
    const client = getRedisClient();
    if (!client) return;
    try {
      await client.del(`${SESSION_PREFIX}${sessionId}:qr`);
    } catch (e) {
      logger.warn("REDIS", `sessionStore.clearQr ${sessionId}`, e);
    }
  },

  async getStatus(sessionId: string): Promise<SessionStatus | null> {
    const client = getRedisClient();
    if (!client) return null;
    try {
      const v = await client.get(`${SESSION_PREFIX}${sessionId}:status`);
      return v as SessionStatus | null;
    } catch {
      return null;
    }
  },

  async getQr(sessionId: string): Promise<string | null> {
    const client = getRedisClient();
    if (!client) return null;
    try {
      return await client.get(`${SESSION_PREFIX}${sessionId}:qr`);
    } catch {
      return null;
    }
  },
};
