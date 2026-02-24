/**
 * Restaura sessões WhatsApp marcadas como "connected" no banco após restart do processo.
 * Deve ser chamado no startup do wa-worker e do backend (quando não for API only).
 */
import { logger } from "../utils/logger";
import { prisma } from "../prismaClient";
import { getOrCreateClient, setSessionLabel } from "../services/whatsappClientManager";

export async function restoreWhatsAppSessions(): Promise<void> {
  const sessions = await prisma.whatsappSession.findMany({
    where: { status: "connected" },
    select: { id: true, name: true, company: { select: { name: true } } },
  });
  if (sessions.length === 0) {
    logger.info("WHATSAPP", "Nenhuma sessão marcada como conectada no banco.");
    return;
  }
  for (const s of sessions) {
    setSessionLabel(s.id, { sessionName: s.name, companyName: s.company.name });
  }
  logger.info("WHATSAPP", `Restaurando ${sessions.length} sessão(ões) conectada(s)...`);
  const delayBetweenSessionsMs = sessions.length > 1 ? 5000 : 2000;
  for (const s of sessions) {
    try {
      await getOrCreateClient(s.id);
    } catch (err) {
      logger.warn("WHATSAPP", `Restore falhou: ${s.company.name} / ${s.name}`, { err });
    }
    await new Promise((r) => setTimeout(r, delayBetweenSessionsMs));
  }
}
