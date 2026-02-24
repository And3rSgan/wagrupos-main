/**
 * Logger de eventos de segurança - auditoria e detecção de ataques.
 * Nunca loga dados sensíveis em claro (emails completos, tokens, payloads).
 */
import { logger } from "../utils/logger";

const SECURITY_SCOPE = "SECURITY";

function maskEmail(email: string): string {
  if (!email || typeof email !== "string") return "?";
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const maskedLocal = local.length <= 2 ? "**" : local[0] + "***" + local[local.length - 1];
  const maskedDomain = domain.length <= 2 ? "**" : domain[0] + "***." + (domain.split(".").pop() ?? "");
  return `${maskedLocal}@${maskedDomain}`;
}

function truncateForLog(payload: string, max = 80): string {
  if (!payload || typeof payload !== "string") return "";
  const cleaned = payload.replace(/\s+/g, " ").trim();
  return cleaned.length <= max ? cleaned : cleaned.slice(0, max) + "...";
}

export const securityLogger = {
  logBruteForce(ip: string, type: string) {
    logger.warn(SECURITY_SCOPE, `[BRUTE-FORCE] IP=${ip} type=${type}`);
  },

  logThrottle(ip: string, path: string) {
    logger.warn(SECURITY_SCOPE, `[THROTTLE] IP=${ip} path=${path}`);
  },

  logBlockedIp(ip: string) {
    logger.warn(SECURITY_SCOPE, `[BLOCKED] IP=${ip}`);
  },

  logSuspicious(req: { ip?: string; path: string; method: string; userId?: string }, reason: string) {
    logger.warn(
      SECURITY_SCOPE,
      `[SUSPICIOUS] IP=${req.ip ?? "?"} path=${req.path} method=${req.method} reason=${reason}`
    );
  },

  logAuthFailure(ip: string, email: string) {
    logger.warn(SECURITY_SCOPE, `[AUTH-FAIL] IP=${ip} email=${maskEmail(email)}`);
  },

  logInvalidToken(ip: string, path: string) {
    logger.warn(SECURITY_SCOPE, `[INVALID-TOKEN] IP=${ip} path=${path}`);
  },

  logSqlInjectionAttempt(ip: string, payload: string) {
    logger.error(SECURITY_SCOPE, `[SQL-INJECTION] IP=${ip} payload=${truncateForLog(payload, 80)}`);
  },

  logPathTraversal(ip: string, path: string) {
    logger.warn(SECURITY_SCOPE, `[PATH-TRAVERSAL] IP=${ip} path=${truncateForLog(path, 100)}`);
  },
};
