import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { prisma } from "./prismaClient";
import { setWhatsappEventEmitter } from "./services/whatsappClientManager";
import { env } from "./config/env";
import { setSocketIo } from "./socketIo";

const jwtSecret = env.jwtSecret;

export function setupSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true },
    path: "/socket.io",
  });

  io.on("connection", (socket) => {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers?.authorization?.replace("Bearer ", "") as string);
    if (!token) {
      socket.disconnect(true);
      return;
    }
    let userId: string;
    try {
      const decoded = jwt.verify(token, jwtSecret) as { sub?: string; userId?: string };
      const rawId = decoded.sub ?? decoded.userId;
      if (typeof rawId !== "string" || !rawId) {
        socket.disconnect(true);
        return;
      }
      userId = rawId;
    } catch {
      socket.disconnect(true);
      return;
    }
    socket.data.userId = userId;

    // Join company room so we can emit invoice:paid to all users of the company
    (async () => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { companyId: true },
      });
      if (user?.companyId) {
        socket.join(`company:${user.companyId}`);
      }
    })();

    socket.on("join_session", async (sessionId: string, cb?: (ok: boolean) => void) => {
      if (typeof sessionId !== "string" || !sessionId.trim()) {
        cb?.(false);
        return;
      }
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { companyId: true },
      });
      const companyId = user?.companyId;
      if (!companyId) {
        cb?.(false);
        return;
      }
      const session = await prisma.whatsappSession.findFirst({
        where: { id: sessionId.trim(), companyId },
      });
      if (!session) {
        cb?.(false);
        return;
      }
      socket.join(`session:${sessionId}`);
      cb?.(true);
    });

    socket.on("leave_session", (sessionId: string) => {
      if (typeof sessionId === "string") {
        socket.leave(`session:${sessionId}`);
      }
    });
  });

  setWhatsappEventEmitter((event, sessionId, data) => {
    const payload =
      data && typeof data === "object" && !Array.isArray(data) && data !== null
        ? { sessionId, ...data }
        : { sessionId };
    io.to(`session:${sessionId}`).emit(`whatsapp:${event}`, payload);
  });

  setSocketIo(io);
  return io;
}
