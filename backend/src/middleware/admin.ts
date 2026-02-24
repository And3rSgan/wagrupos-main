import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
import { prisma } from "../prismaClient";

export async function adminMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !["ADMIN", "SUPERADMIN"].includes(user.role)) {
    return res.status(403).json({ message: "Acesso negado" });
  }

  return next();
}

