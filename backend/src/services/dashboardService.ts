import { prisma } from "../prismaClient";
import { getConnectionStatus } from "./whatsappConnectionService";
import { getQrDataUrl, isClientReady } from "./whatsappClientManager";

export type SessionDisplayStatus = "connected" | "qr_pending" | "disconnected" | "ban_risk";

export interface DashboardData {
  sessionStatus: SessionDisplayStatus;
  sessionDetails: {
    pushName?: string | null;
    phone?: string | null;
    lastConnectedAt?: Date | null;
  };
  dailyStats: {
    messagesSent: number;
    failures: number;
    groupsReached: number;
    linkClicks: number;
  };
  queue: {
    running: { id: string; title: string | null; status: string }[];
    upcoming: { id: string; title: string | null; scheduledAt: Date }[];
    paused: { id: string; title: string | null }[];
  };
  alerts: string[];
}

function getStartOfDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const todayStart = getStartOfDay();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true, role: true },
  });
  let companyId = user?.companyId ?? null;
  if (!companyId && user?.role === "SUPERADMIN") {
    const sist = await prisma.company.findFirst({
      where: { slug: "sistema-administrativo" },
      select: { id: true },
    });
    if (sist) companyId = sist.id;
  }

  // Session status (usa primeira sessão da empresa)
  const session = companyId
    ? await prisma.whatsappSession.findFirst({
        where: { companyId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      })
    : null;
  type ConnStatus = { status: SessionDisplayStatus | string; pushName: string | null; phone: string | null; lastConnectedAt: Date | null };
  let connStatus: ConnStatus = {
    status: "disconnected",
    pushName: null,
    phone: null,
    lastConnectedAt: null,
  };
  let qr: string | null = null;
  let ready = false;
  if (session && companyId) {
    try {
      connStatus = await getConnectionStatus(session.id, companyId);
    } catch (_) {}
    qr = getQrDataUrl(session.id);
    ready = isClientReady(session.id);
  }

  // Confia no status do DB quando "connected": após restart o client pode ainda estar restaurando em background
  let sessionStatus: SessionDisplayStatus = "disconnected";
  if (connStatus.status === "connected") {
    sessionStatus = "connected";
  } else if (!ready && qr) {
    sessionStatus = "qr_pending";
  } else if (connStatus.status === "ban_risk") {
    sessionStatus = "ban_risk";
  }

  // Daily stats from MessageSend
  const sendsToday = await prisma.messageSend.findMany({
    where: {
      userId,
      createdAt: { gte: todayStart },
    },
    select: { id: true, status: true, groupId: true },
  });

  const sentIds = sendsToday.filter((s) => s.status === "sent").map((s) => s.id);
  const linkClicks = sentIds.length
    ? await prisma.linkClick.count({ where: { messageSendId: { in: sentIds } } })
    : 0;

  const messagesSent = sendsToday.filter((s) => s.status === "sent").length;
  const failures = sendsToday.filter((s) => s.status === "failed").length;
  const groupsReached = new Set(sendsToday.filter((s) => s.status === "sent").map((s) => s.groupId)).size;

  // Queue: running (queued and due), upcoming (scheduled future), paused
  const campaigns = await prisma.campaign.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { scheduledAt: "asc" }],
    select: { id: true, title: true, status: true, scheduledAt: true },
  });

  const now = new Date();
  const running = campaigns.filter(
    (c) => c.status === "queued" && (!c.scheduledAt || c.scheduledAt <= now)
  );
  const upcoming = campaigns.filter(
    (c) => (c.status === "draft" || c.status === "queued") && c.scheduledAt && c.scheduledAt > now
  );
  const paused = campaigns.filter((c) => c.status === "paused");

  // Alerts
  const alerts: string[] = [];
  if (failures >= 5 && failures > messagesSent) {
    alerts.push("Muitos erros hoje. Verifique a conexão e os grupos.");
  }
  if (messagesSent > 100 && failures === 0) {
    alerts.push("Disparo muito rápido hoje. Considere reduzir o volume para evitar bloqueios.");
  }
  if (failures > 0) {
    const failReasons = await prisma.messageSend.findMany({
      where: { userId, status: "failed", createdAt: { gte: todayStart } },
      select: { error: true },
    });
    const blocked = failReasons.some((r) => r.error?.toLowerCase().includes("blocked") || r.error?.toLowerCase().includes("bloqueado"));
    if (blocked) {
      alerts.push("Algum grupo bloqueou o envio. Revise os grupos com falha.");
    }
  }
  if (sessionStatus === "disconnected" && !qr) {
    alerts.push("Sessão desconectada. Reconecte escaneando o QR code.");
  }

  return {
    sessionStatus,
    sessionDetails: {
      pushName: connStatus.pushName,
      phone: connStatus.phone,
      lastConnectedAt: connStatus.lastConnectedAt,
    },
    dailyStats: {
      messagesSent,
      failures,
      groupsReached,
      linkClicks,
    },
    queue: {
      running: running.map((c) => ({ id: c.id, title: c.title, status: c.status })),
      upcoming: (upcoming as { id: string; title: string | null; scheduledAt: Date }[]).map((c) => ({
        id: c.id,
        title: c.title,
        scheduledAt: c.scheduledAt,
      })),
      paused: paused.map((c) => ({ id: c.id, title: c.title })),
    },
    alerts,
  };
}
