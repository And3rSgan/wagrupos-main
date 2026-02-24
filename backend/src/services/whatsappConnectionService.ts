import { prisma } from "../prismaClient";
import {
  getOrCreateClient,
  getClientInfo,
  isClientReady,
  getQrDataUrl,
  getClientState,
  destroyClient,
  logoutSession,
  restartClient,
  releasePairingClient,
  setSessionLabel,
} from "./whatsappClientManager";

const CONNECTED_GRACE_MS = 5 * 60 * 1000;

/**
 * Retorna status da conexão. Se a sessão está "connected" no DB mas o client
 * não está em memória (ex.: após restart), inicia o client em background para
 * restaurar a sessão e retorna o status do DB para o dashboard não mostrar
 * "Desconectado" enquanto restaura.
 */
export async function getConnectionStatus(sessionId: string, companyId: string) {
  const session = await prisma.whatsappSession.findFirst({
    where: { id: sessionId, companyId },
    include: { company: { select: { name: true } } },
  });
  if (!session) throw new Error("Sessão não encontrada");
  setSessionLabel(sessionId, { sessionName: session.name, companyName: session.company.name });

  const state = getClientState(sessionId);
  const ready = isClientReady(sessionId);
  const info = getClientInfo(sessionId);
  const qr = getQrDataUrl(sessionId);

  // Sessão conectada no DB mas client não em memória (ex.: após build/restart) → inicia restauração em background
  if (session.status === "connected" && !state) {
    void getOrCreateClient(sessionId);
  }

  // Só atualiza DB quando temos client em memória (foi iniciado via getQrCode ou restauração)
  if (state) {
    if (ready && info) {
      await prisma.whatsappSession.update({
        where: { id: sessionId },
        data: {
          status: "connected",
          waPushName: info.pushName,
          waPhone: info.phone,
          waJid: info.wid,
          waAvatarUrl: info.avatarUrl,
          lastConnectedAt: new Date(),
        },
      });
    } else {
      const recentlyConnected =
        session.status === "connected" &&
        session.lastConnectedAt !== null &&
        Date.now() - session.lastConnectedAt.getTime() <= CONNECTED_GRACE_MS;
      // Não marcar como desconectado quando a sessão está "connected" no DB e não há QR: client pode estar restaurando (ex.: após restart)
      const likelyRestoring = session.status === "connected" && !qr;
      if (!likelyRestoring && (!recentlyConnected || qr)) {
        await prisma.whatsappSession.update({
          where: { id: sessionId },
          data: { status: "disconnected" },
        });
      }
    }
  }

  const updated = await prisma.whatsappSession.findUnique({
    where: { id: sessionId },
  });
  return {
    id: updated!.id,
    name: updated!.name,
    isDefault: updated!.isDefault,
    status: updated!.status,
    pushName: updated!.waPushName,
    phone: updated!.waPhone,
    jid: updated!.waJid,
    avatarUrl: updated!.waAvatarUrl,
    lastConnectedAt: updated!.lastConnectedAt,
  };
}

/** QR gerado no processo da API (sem fila). Se já conectado, retorna alreadyConnected. */
export async function getQrCode(sessionId: string, companyId: string) {
  const session = await prisma.whatsappSession.findFirst({
    where: { id: sessionId, companyId },
    include: { company: { select: { name: true } } },
  });
  if (!session) throw new Error("Sessão não encontrada");
  setSessionLabel(sessionId, { sessionName: session.name, companyName: session.company.name });

  if (isClientReady(sessionId)) {
    return { qr: null, message: "Sessão já conectada.", alreadyConnected: true };
  }

  await getOrCreateClient(sessionId);

  const qr = getQrDataUrl(sessionId);
  if (!qr) {
    return { qr: null, message: "QR ainda não foi gerado. Aguarde alguns segundos e tente novamente." };
  }
  return { qr };
}

export async function disconnect(sessionId: string, companyId: string) {
  const session = await prisma.whatsappSession.findFirst({
    where: { id: sessionId, companyId },
  });
  if (!session) throw new Error("Sessão não encontrada");

  await logoutSession(sessionId);
  await destroyClient(sessionId);
  await prisma.whatsappSession.update({
    where: { id: sessionId },
    data: { status: "disconnected" },
  });
  return { ok: true };
}

export async function restart(sessionId: string, companyId: string) {
  const session = await prisma.whatsappSession.findFirst({
    where: { id: sessionId, companyId },
  });
  if (!session) throw new Error("Sessão não encontrada");

  await restartClient(sessionId);
  return { ok: true };
}

/** Libera o client em pairing quando o usuário fecha o modal sem conectar. Para de gerar QR. */
export async function releasePairing(sessionId: string, companyId: string) {
  const session = await prisma.whatsappSession.findFirst({
    where: { id: sessionId, companyId },
  });
  if (!session) throw new Error("Sessão não encontrada");

  await releasePairingClient(sessionId);
  return { ok: true };
}
