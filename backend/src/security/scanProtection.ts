/**
 * Proteção contra varreduras e ataques automatizados.
 * - Detecta requisições de scan (PHPUnit, ThinkPHP, Docker API, path traversal, etc.)
 * - Reduz ruído no log (não loga 404 de scan como WARN)
 * - Após N tentativas do mesmo IP, adiciona à blocklist dinâmica (Redis ou in-memory)
 */
import { Request } from "express";
import { getRedisClient } from "../redis";
import { logger } from "../utils/logger";

const BLOCKLIST_KEY_PREFIX = "security:blocklist:";
const BLOCKLIST_TTL_SEC = 7 * 24 * 3600; // 7 dias
const SCAN_THRESHOLD = 3; // após 3 requisições de scan (404), bloqueia o IP
const SCAN_COUNT_WINDOW_MS = 5 * 60 * 1000; // janela de 5 minutos

/** Padrões de path/query típicos de varredura ou exploit (PHP, ThinkPHP, Docker, etc.) */
const SCAN_PATTERNS = [
  /phpunit/i,
  /eval-stdin\.php/i,
  /think\\?\/app/i,
  /invokefunction/i,
  /containers\/json/i,
  /\.\.\/\.\.\//,
  /\.\.\\\.\.\\/,
  /%2e%2e%2f/i,
  /wp-admin/i,
  /wp-login/i,
  /\.env$/i,
  /config\.php/i,
  /shell\.php/i,
  /alfa\.php/i,
];

/** Contadores por IP (requisições de scan que resultaram em 404). Limpeza por janela. */
const scanCountByIp = new Map<string, { count: number; firstAt: number }>();

function normalizeIp(ip: string): string {
  return (ip || "unknown").replace(/^::ffff:/, "");
}

/** Verifica se a requisição é típica de varredura/exploit. */
export function isScanRequest(req: Request): boolean {
  const path = (req.path || "") + (req.url || "");
  const lower = path.toLowerCase();
  return SCAN_PATTERNS.some((p) => p.test(path) || p.test(lower));
}

/** Verifica se o IP está na blocklist dinâmica (Redis ou in-memory). */
export async function isInDynamicBlocklist(ip: string): Promise<boolean> {
  const normalized = normalizeIp(ip);
  if (normalized === "unknown") return false;

  const redis = getRedisClient();
  if (redis) {
    try {
      const v = await redis.get(BLOCKLIST_KEY_PREFIX + normalized);
      return v !== null && v !== undefined;
    } catch {
      return false;
    }
  }
  return dynamicBlocklistMemory.has(normalized);
}

/** Blocklist em memória quando Redis não está disponível (perdida no restart). */
const dynamicBlocklistMemory = new Set<string>();

/** Adiciona IP à blocklist dinâmica (Redis com TTL 7 dias ou in-memory). */
export async function addToDynamicBlocklist(ip: string): Promise<void> {
  const normalized = normalizeIp(ip);
  if (normalized === "unknown") return;

  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.set(BLOCKLIST_KEY_PREFIX + normalized, "1", "EX", BLOCKLIST_TTL_SEC);
      logger.warn("SECURITY", `[BLOCKLIST] IP ${normalized} adicionado à blocklist (scan/ataque). Bloqueio por 7 dias.`);
    } catch (e) {
      logger.warn("SECURITY", "Falha ao adicionar IP à blocklist no Redis", e);
      dynamicBlocklistMemory.add(normalized);
    }
  } else {
    dynamicBlocklistMemory.add(normalized);
    logger.warn("SECURITY", `[BLOCKLIST] IP ${normalized} adicionado à blocklist em memória (scan/ataque).`);
  }
}

/**
 * Registra uma requisição de scan que resultou em 404.
 * Se o IP atingir SCAN_THRESHOLD tentativas na janela, é adicionado à blocklist.
 * Retorna true se a requisição deve ser omitida do log HTTP (redução de ruído).
 */
export async function recordScanAttempt(ip: string, path: string, statusCode: number): Promise<{ skipLog: boolean }> {
  if (statusCode !== 404) return { skipLog: false };
  if (!path || !isScanLikePath(path)) return { skipLog: false };

  const normalized = normalizeIp(ip);
  if (normalized === "unknown") return { skipLog: true };

  const now = Date.now();
  let entry = scanCountByIp.get(normalized);
  if (!entry) {
    entry = { count: 1, firstAt: now };
    scanCountByIp.set(normalized, entry);
  } else {
    if (now - entry.firstAt > SCAN_COUNT_WINDOW_MS) {
      entry = { count: 1, firstAt: now };
      scanCountByIp.set(normalized, entry);
    } else {
      entry.count += 1;
    }
  }

  if (entry.count >= SCAN_THRESHOLD) {
    scanCountByIp.delete(normalized);
    await addToDynamicBlocklist(normalized);
  }

  return { skipLog: true };
}

/** Verifica se path parece scan sem precisar do objeto Request. */
function isScanLikePath(path: string): boolean {
  const lower = (path || "").toLowerCase();
  return SCAN_PATTERNS.some((p) => p.test(path) || p.test(lower));
}
