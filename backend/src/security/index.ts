/**
 * Módulo de Segurança Cibernética
 * Proteção contra: DDoS, brute-force, injeção, XSS, uso indevido de API, ataques ao banco
 */
import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { env } from "../config/env";
import { securityLogger } from "./securityLogger";
import { isInDynamicBlocklist } from "./scanProtection";

// Re-export para uso externo
export { securityLogger } from "./securityLogger";
export { createAuthLimiter } from "./bruteForceProtection";

/**
 * Rate limit geral - Anti-DDoS e abuso de API
 * Limita requisições por IP em janela de tempo
 */
export const generalRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: env.security.rateLimitGeneral ?? 100,
  message: { message: "Muitas requisições. Tente novamente em alguns minutos." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/api/health",
  handler: (req, res) => {
    securityLogger.logThrottle(req.ip ?? "unknown", req.path);
    res.status(429).json({ message: "Limite de requisições excedido. Tente novamente em 1 minuto." });
  },
});

/**
 * Rate limit estrito para auth - anti brute-force
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: env.security.rateLimitAuth ?? 10,
  message: { message: "Muitas tentativas de login. Aguarde 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // só conta falhas
  handler: (req, res) => {
    securityLogger.logBruteForce(req.ip ?? "unknown", "login");
    res.status(429).json({ message: "Bloqueado por segurança. Tente novamente em 15 minutos." });
  },
});

/**
 * Rate limit para registro - anti spam de contas
 */
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: env.security.rateLimitRegister ?? 5,
  message: { message: "Muitos registros. Tente novamente em 1 hora." },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    securityLogger.logBruteForce(req.ip ?? "unknown", "register");
    res.status(429).json({ message: "Limite de cadastros excedido. Tente novamente mais tarde." });
  },
});

/**
 * Rate limit para APIs sensíveis (campanhas, webhooks, etc)
 */
export const sensitiveApiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: env.security.rateLimitSensitive ?? 30,
  message: { message: "Limite de operações excedido. Aguarde um momento." },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Configuração Helmet reforçada - headers de segurança
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: env.nodeEnv === "production",
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: env.nodeEnv === "production"
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  frameguard: { action: "deny" },
  ieNoOpen: true,
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
});

/**
 * Middleware de sanitização - remove caracteres perigosos (injeção, XSS)
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === "object") {
    req.query = sanitizeObject(req.query as Record<string, unknown>) as Record<string, string>;
  }
  next();
}

function sanitizeObject(obj: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (depth > 10) return obj; // proteção contra objetos circulares profundos
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") {
      result[k] = sanitizeString(v);
    } else if (v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      result[k] = sanitizeObject(v as Record<string, unknown>, depth + 1);
    } else if (Array.isArray(v)) {
      result[k] = v.map((item) =>
        typeof item === "string" ? sanitizeString(item) : item
      );
    } else {
      result[k] = v;
    }
  }
  return result;
}

function sanitizeString(s: string): string {
  return s
    .replace(/\0/g, "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/vbscript:/gi, "")
    .replace(/data:\s*text\/html/gi, "")
    .replace(/data:\s*image\/svg\+xml/gi, "")
    .replace(/expression\s*\(/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .replace(/<\s*iframe/gi, "")
    .trim();
}

/**
 * Middleware - bloqueia IPs na blocklist estática (env) + dinâmica (scan → Redis/memória)
 */
export function ipBlocklistMiddleware(staticBlocklist: Set<string>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const normalizedIp = ip.replace(/^::ffff:/, "");
    if (staticBlocklist.has(normalizedIp) || staticBlocklist.has(ip)) {
      securityLogger.logBlockedIp(ip);
      return res.status(403).json({ message: "Acesso negado." });
    }
    try {
      if (await isInDynamicBlocklist(ip)) {
        securityLogger.logBlockedIp(ip);
        return res.status(403).json({ message: "Acesso negado." });
      }
    } catch (_) {
      // falha ao checar Redis: deixa passar
    }
    next();
  };
}

/**
 * Limite de tamanho do body - anti payload grande (DoS)
 */
export const bodySizeLimit = "2mb";
