import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../prismaClient";
import { securityLogger } from "../security/securityLogger";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  companyId?: string | null;
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Token não enviado" });
  }

  const [, token] = authHeader.split(" ");

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as {
      sub: string;
      role?: string;
      companyId?: string;
    };
    req.userId = decoded.sub;
    req.userRole = decoded.role;
    req.companyId = decoded.companyId ?? null;
    return next();
  } catch {
    securityLogger.logInvalidToken(req.ip ?? "unknown", req.path);
    return res.status(401).json({ message: "Token inválido" });
  }
}

/** Enriquecer req com dados frescos do usuário (role, companyId) */
export async function enrichAuth(req: AuthRequest) {
  if (!req.userId) return;
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { role: true, companyId: true },
  });
  if (user) {
    req.userRole = user.role;
    req.companyId = user.companyId;
    if (user.role === "SUPERADMIN" && !user.companyId) {
      const sist = await prisma.company.findFirst({
        where: { slug: "sistema-administrativo" },
        select: { id: true },
      });
      if (sist) req.companyId = sist.id;
    }
  }
}/** Apenas SuperAdmin */
export function superAdminMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  (async () => {
    try {
      if (req.userRole === "SUPERADMIN") return next();
      if (req.userId) {
        const user = await prisma.user.findUnique({
          where: { id: req.userId },
          select: { role: true },
        });
        if (user?.role === "SUPERADMIN") return next();
      }
      res.status(403).json({ message: "Acesso restrito ao SuperAdmin" });
    } catch (e) {
      next(e);
    }
  })();
}
