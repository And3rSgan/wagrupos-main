/**
 * Proteção contra brute-force em endpoints de autenticação
 */
import rateLimit from "express-rate-limit";
import { securityLogger } from "./securityLogger";
import { env } from "../config/env";

export function createAuthLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.security.rateLimitAuth ?? 10,
    message: { message: "Muitas tentativas. Aguarde 15 minutos." },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
      const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
      const email = (req.body?.email as string) ?? "";
      return `${ip}:${email.toLowerCase()}`;
    },
    handler: (req, res) => {
      securityLogger.logBruteForce(req.ip ?? "unknown", "login");
      res.status(429).json({ message: "Bloqueado por segurança. Tente novamente em 15 minutos." });
    },
  });
}
