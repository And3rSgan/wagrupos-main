import makeWASocket, {
  type WASocket,
  type WAVersion,
  DisconnectReason,
  fetchLatestWaWebVersion,
  fetchLatestBaileysVersion,
  isJidBroadcast,
} from "libzapitu-rf";
import * as QRCode from "qrcode";
import { logger } from "../utils/logger";
import { sessionStore } from "../redis";
import { prisma } from "../prismaClient";
import { usePrismaAuthState, clearPrismaAuthState } from "./whatsappPrismaAuthState";

/** Fallback WA version quando a busca dinâmica falha (ex.: 405 por versão desatualizada). */
const FALLBACK_WA_VERSION: WAVersion = [2, 3000, 1015901307];

const WA_VERSION_CACHE_MS = 1000 * 60 * 60; // 1 hora
let cachedWaVersion: { version: WAVersion; at: number } | null = null;

/**
 * Obtém a versão do WhatsApp para a conexão. Tenta buscar dinamicamente (web.whatsapp.com
 * ou Baileys) para evitar erro 405; usa fallback fixo em caso de falha.
 */
export async function getWaVersion(): Promise<WAVersion> {
  const now = Date.now();
  if (cachedWaVersion && now - cachedWaVersion.at < WA_VERSION_CACHE_MS) {
    return cachedWaVersion.version;
  }
  try {
    const result = await fetchLatestWaWebVersion({ timeout: 10000 });
    if (result.version && Array.isArray(result.version) && result.version.length >= 3) {
      cachedWaVersion = { version: result.version as WAVersion, at: now };
      logger.info("WHATSAPP", `Versão WA obtida (web): [${result.version.join(", ")}]`);
      return cachedWaVersion.version;
    }
  } catch (e) {
    logger.warn("WHATSAPP", "Falha ao buscar versão WA (web), tentando Baileys", { e });
  }
  try {
    const result = await fetchLatestBaileysVersion({ timeout: 10000 });
    if (result.version && Array.isArray(result.version) && result.version.length >= 3) {
      cachedWaVersion = { version: result.version as WAVersion, at: now };
      logger.info("WHATSAPP", `Versão WA obtida (baileys): [${result.version.join(", ")}]`);
      return cachedWaVersion.version;
    }
  } catch (e) {
    logger.warn("WHATSAPP", "Falha ao buscar versão WA (baileys), usando fallback", { e });
  }
  cachedWaVersion = { version: FALLBACK_WA_VERSION, at: now };
  logger.info("WHATSAPP", `Versão WA fallback: [${FALLBACK_WA_VERSION.join(", ")}]`);
  return FALLBACK_WA_VERSION;
}

type WhatsappEventCallback = (
  event: string,
  sessionId: string,
  data?: { qr?: string; message?: string; reason?: string }
) => void;

let eventEmitter: WhatsappEventCallback | null = null;
const onDestroySessionCallbacks = new Set<(sessionId: string) => void>();

export function setWhatsappEventEmitter(emitter: WhatsappEventCallback): void {
  eventEmitter = emitter;
}

/** Registra callback chamado ao destruir uma sessão (ex.: limpar cache de grupos). */
export function onDestroySession(cb: (sessionId: string) => void): () => void {
  onDestroySessionCallbacks.add(cb);
  return () => onDestroySessionCallbacks.delete(cb);
}

/** Rótulo para logs: empresa + nome da sessão (preenchido por restore e rotas). */
const sessionLabels = new Map<string, { sessionName: string; companyName: string }>();

export function setSessionLabel(
  sessionId: string,
  data: { sessionName: string; companyName: string }
): void {
  sessionLabels.set(sessionId, data);
}

function formatSession(sessionId: string): string {
  const label = sessionLabels.get(sessionId);
  if (label) return `${label.companyName} / ${label.sessionName}`;
  return sessionId;
}

/** Retorna nome legível da sessão (empresa / sessão) para uso em logs. */
export function getSessionDisplayName(sessionId: string): string {
  return formatSession(sessionId);
}

export interface ClientState {
  sock: WASocket;
  qrDataUrl: string | null;
  isReady: boolean;
  pushName: string | null;
  phone: string | null;
  wid: string | null;
  avatarUrl: string | null;
}

const clients = new Map<string, ClientState>();
const pendingCreate = new Map<string, Promise<ClientState>>();

const MAX_CONCURRENT_INITS = 1;
const INIT_SLOT_RELEASE_DELAY_MS = 8000;

function getBackoffDelayMs(attempt: number): number {
  const baseMs = 5000;
  const maxMs = 120000;
  const delay = Math.min(baseMs * Math.pow(2, attempt - 1), maxMs);
  return Math.min(delay, maxMs);
}
/** Delay genérico após destroy antes de recriar (ex.: restartClient). */
const RESTART_DELAY_MS = 2500;
/** Máximo de tentativas de reconexão automática; após isso para e exige nova conexão manual. */
const MAX_RECONNECT_ATTEMPTS = 3;
/** Mínimo de intervalo entre atualizações de QR (evita loops que invalidam a sessão). */
const QR_MIN_INTERVAL_MS = 15000;
let currentInits = 0;
const initWaitQueue: Array<() => void> = [];
const lastQrAtBySession = new Map<string, number>();
/** Contagem de falhas consecutivas (ex.: 405) por sessão; ao atingir MAX_RECONNECT_ATTEMPTS para de reconectar. */
const connectionFailureCountBySession = new Map<string, number>();

function releaseInitSlot(): void {
  currentInits = Math.max(0, currentInits - 1);
  const next = initWaitQueue.shift();
  if (next) next();
}

function acquireInitSlot(): Promise<void> {
  if (currentInits < MAX_CONCURRENT_INITS) {
    currentInits++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    initWaitQueue.push(() => {
      currentInits++;
      resolve();
    });
  });
}

/** Mensagens do Baileys que são transitórias (sessão/criptografia) e não precisam aparecer como ERROR. */
const BAILEYS_TRANSIENT_ERRORS = [
  "failed to decrypt message",
  "transaction failed, rolling back",
  "stream errored out",
  "timed out waiting for message",
  "error in handling message",
  "handling notification",
  "closing open session in favor of incoming prekey bundle",
];

function isTransientBaileysError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return BAILEYS_TRANSIENT_ERRORS.some((s) => lower.includes(s.toLowerCase()));
}

/** Logger compatível com ILogger do Baileys. Erros transitórios viram WARN em vez de ERROR. */
function makeBaileysLogger(sessionId: string) {
  const tag = formatSession(sessionId);
  return {
    level: "info",
    child() {
      return this;
    },
    trace() {},
    debug() {},
    info(_obj: unknown, msg?: string) {
      if (msg) logger.info("WHATSAPP", `${tag} | ${msg}`);
    },
    warn(_obj: unknown, msg?: string) {
      if (msg) logger.warn("WHATSAPP", `${tag} | ${msg}`);
    },
    error(_obj: unknown, msg?: string) {
      if (!msg) return;
      if (isTransientBaileysError(msg)) {
        logger.warn("WHATSAPP", `${tag} | ${msg}`);
      } else {
        logger.error("WHATSAPP", `${tag} | ${msg}`);
      }
    },
  };
}

async function refreshSelfAvatar(sessionId: string): Promise<void> {
  const state = clients.get(sessionId);
  if (!state?.isReady || !state.wid) return;
  try {
    const url = await state.sock.profilePictureUrl(state.wid, "image");
    const current = clients.get(sessionId);
    if (current) current.avatarUrl = url ?? null;
  } catch {
    logger.warn("WHATSAPP", `Avatar não obtido: ${formatSession(sessionId)}`);
  }
}

async function createClientForSession(sessionId: string): Promise<ClientState> {
  const { state: authState, saveCreds } = await usePrismaAuthState(sessionId);

  const version = await getWaVersion();

  const sock = makeWASocket({
    auth: authState as Parameters<typeof makeWASocket>[0]["auth"],
    logger: makeBaileysLogger(sessionId),
    printQRInTerminal: false,
    emitOwnEvents: false,
    markOnlineOnConnect: false,
    browser: ["WAGrupos", "Desktop", "1.0.0"],
    version,
    defaultQueryTimeoutMs: 60000,
    getMessage: async () => undefined,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    shouldIgnoreJid: (jid) => isJidBroadcast(jid) || (jid?.endsWith?.("@newsletter") === true),
  });

  const clientState: ClientState = {
    sock,
    qrDataUrl: null,
    isReady: false,
    pushName: null,
    phone: null,
    wid: null,
    avatarUrl: null,
  };

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update: { connection?: string; qr?: string; lastDisconnect?: { error?: unknown } }) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      const now = Date.now();
      const lastQr = lastQrAtBySession.get(sessionId) ?? 0;
      const isFirstQr = lastQr === 0;
      const throttleOk = isFirstQr || now - lastQr >= QR_MIN_INTERVAL_MS;
      if (throttleOk) {
        lastQrAtBySession.set(sessionId, now);
        try {
          const dataUrl = await QRCode.toDataURL(qr, { width: 320 });
          const s = clients.get(sessionId);
          if (s) s.qrDataUrl = dataUrl;
          eventEmitter?.("qr", sessionId, { qr: dataUrl });
          await sessionStore.setStatus(sessionId, "qr");
          await sessionStore.setQr(sessionId, dataUrl);
          logger.info("WHATSAPP", `QR gerado: ${formatSession(sessionId)}`);
        } catch (err) {
          logger.error("WHATSAPP", `Erro ao gerar QR: ${formatSession(sessionId)}`, err);
        }
      }
    }

    if (connection === "open") {
      connectionFailureCountBySession.set(sessionId, 0);
      const s = clients.get(sessionId);
      if (s) {
        s.isReady = true;
        s.qrDataUrl = null;
        const user = sock.user;
        if (user) {
          s.pushName = user.name ?? null;
          s.wid = user.id ?? null;
          s.phone = user.id?.split?.("@")?.[0] ?? null;
        }
      }
      const s2 = clients.get(sessionId);
      const meta = {
        pushName: s2?.pushName ?? undefined,
        phone: s2?.phone ?? undefined,
        wid: s2?.wid ?? undefined,
      };
      await sessionStore.setStatus(sessionId, "connected");
      await sessionStore.setMeta(sessionId, meta);
      await sessionStore.clearQr(sessionId);
      eventEmitter?.("ready", sessionId);
      void refreshSelfAvatar(sessionId);
      logger.success("WHATSAPP", `Conectado: ${formatSession(sessionId)}`);
    }

    if (connection === "close") {
      const err = lastDisconnect?.error as { output?: { statusCode?: number }; message?: string } | undefined;
      const statusCode = err?.output?.statusCode;
      const reasonMessage = err?.message ?? (err ? String(err) : "unknown");
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const isAuthFailure =
        statusCode === DisconnectReason.badSession ||
        statusCode === DisconnectReason.forbidden ||
        statusCode === DisconnectReason.multideviceMismatch;
      const shouldReconnect = !isLoggedOut && !isAuthFailure;

      logger.warn(
        "WHATSAPP",
        `[Closing session] ${formatSession(sessionId)} | statusCode=${statusCode} | reason=${reasonMessage} | loggedOut=${isLoggedOut} | willReconnect=${shouldReconnect}`
      );

      const s = clients.get(sessionId);
      if (s) {
        s.isReady = false;
        s.qrDataUrl = null;
        s.pushName = null;
        s.phone = null;
        s.wid = null;
        s.avatarUrl = null;
      }
      await sessionStore.setStatus(sessionId, "disconnected");
      await sessionStore.clearQr(sessionId);
      await prisma.whatsappSession
        .updateMany({
          where: { id: sessionId },
          data: { status: "disconnected" },
        })
        .catch((e: unknown) =>
          logger.error("WHATSAPP", `Falha ao persistir disconnected: ${formatSession(sessionId)}`, e)
        );
      if (isAuthFailure) {
        eventEmitter?.("auth_failure", sessionId, {
          message: String(statusCode ?? "Falha de autenticação"),
        });
      }
      eventEmitter?.("disconnected", sessionId, {
        reason: isLoggedOut ? "loggedOut" : String(statusCode ?? "close"),
      });

      setImmediate(() => {
        destroyClient(sessionId).catch(() => {});
      });

      if (shouldReconnect) {
        const sid = sessionId;
        const failures = (connectionFailureCountBySession.get(sid) ?? 0) + 1;
        connectionFailureCountBySession.set(sid, failures);

        if (failures >= MAX_RECONNECT_ATTEMPTS) {
          logger.warn(
            "WHATSAPP",
            `Limite de reconexões (${MAX_RECONNECT_ATTEMPTS}) atingido: ${formatSession(sid)}. Conexão encerrada; reconecte manualmente no painel.`
          );
          connectionFailureCountBySession.delete(sid);
          clearPrismaAuthState(sid).catch((e) =>
            logger.warn("WHATSAPP", `Falha ao limpar auth: ${formatSession(sid)}`, e)
          );
          eventEmitter?.("disconnected", sid, { reason: "max_reconnect_attempts" });
          return;
        }

        const delayMs = getBackoffDelayMs(failures);
        logger.info("WHATSAPP", `Reconectando (tentativa ${failures}/${MAX_RECONNECT_ATTEMPTS}) em ${delayMs}ms: ${formatSession(sid)}`);
        setTimeout(() => {
          getOrCreateClient(sid).catch((e) =>
            logger.error("WHATSAPP", `Falha ao reconectar: ${formatSession(sid)}`, e)
          );
        }, delayMs);
      }
    }
  });

  clients.set(sessionId, clientState);
  return clientState;
}

/**
 * Obtém ou cria o client da sessão. Criação é serializada por sessionId
 * e limitada globalmente (1 por vez).
 */
export async function getOrCreateClient(sessionId: string): Promise<ClientState> {
  const existing = clients.get(sessionId);
  if (existing) return existing;

  const pending = pendingCreate.get(sessionId);
  if (pending) return pending;

  const promise = (async (): Promise<ClientState> => {
    const again = clients.get(sessionId);
    if (again) return again;
    await acquireInitSlot();
    try {
      const state = await createClientForSession(sessionId);
      setTimeout(() => releaseInitSlot(), INIT_SLOT_RELEASE_DELAY_MS);
      return state;
    } catch (e) {
      releaseInitSlot();
      pendingCreate.delete(sessionId);
      clients.delete(sessionId);
      await sessionStore.setStatus(sessionId, "disconnected");
      await prisma.whatsappSession
        .updateMany({ where: { id: sessionId }, data: { status: "disconnected" } })
        .catch(() => {});
      throw e;
    }
  })();
  pendingCreate.set(sessionId, promise);
  try {
    const state = await promise;
    pendingCreate.delete(sessionId);
    return state;
  } catch (e) {
    pendingCreate.delete(sessionId);
    throw e;
  }
}

/** Síncrono: retorna o state se já existir. */
export function getOrCreateClientSync(sessionId: string): ClientState | undefined {
  return clients.get(sessionId);
}

export function getClientState(sessionId: string): ClientState | undefined {
  return clients.get(sessionId);
}

export function isClientReady(sessionId: string): boolean {
  const state = clients.get(sessionId);
  return state?.isReady === true;
}

export function getQrDataUrl(sessionId: string): string | null {
  const state = clients.get(sessionId);
  return state?.qrDataUrl ?? null;
}

export function getClientInfo(sessionId: string): {
  pushName: string | null;
  phone: string | null;
  wid: string | null;
  avatarUrl: string | null;
} | null {
  const state = clients.get(sessionId);
  if (!state || !state.isReady) return null;
  return {
    pushName: state.pushName,
    phone: state.phone,
    wid: state.wid,
    avatarUrl: state.avatarUrl,
  };
}

/** Logout no WhatsApp (remove da lista "Meus dispositivos") e limpa auth no banco. */
export async function logoutSession(sessionId: string): Promise<void> {
  const state = clients.get(sessionId);
  if (state?.sock) {
    try {
      await state.sock.logout();
      logger.info("WHATSAPP", `Logout: ${formatSession(sessionId)} (removido de "Meus dispositivos")`);
    } catch (err) {
      logger.warn("WHATSAPP", `Logout falhou: ${formatSession(sessionId)}`, { err });
    }
  }
  try {
    await clearPrismaAuthState(sessionId);
  } catch (err) {
    logger.warn("WHATSAPP", `Limpeza do auth state falhou: ${formatSession(sessionId)}`, { err });
  }
}

export async function destroyClient(sessionId: string): Promise<void> {
  pendingCreate.delete(sessionId);
  lastQrAtBySession.delete(sessionId);
  const state = clients.get(sessionId);
  if (!state) return;
  clients.delete(sessionId);
  for (const cb of onDestroySessionCallbacks) {
    try {
      cb(sessionId);
    } catch (e) {
      logger.warn("WHATSAPP", `onDestroySession callback: ${formatSession(sessionId)}`, { e });
    }
  }
  try {
    state.sock.end(undefined);
  } catch (err) {
    logger.error("WHATSAPP", `Erro ao destruir: ${formatSession(sessionId)}`, err);
  }
}

/** Destrói o client apenas se estiver em modo pairing (aguardando QR). */
export async function releasePairingClient(sessionId: string): Promise<void> {
  pendingCreate.delete(sessionId);
  const state = clients.get(sessionId);
  if (!state || state.isReady) return;
  clients.delete(sessionId);
  for (const cb of onDestroySessionCallbacks) {
    try {
      cb(sessionId);
    } catch (e) {
      logger.warn("WHATSAPP", `onDestroySession callback: ${formatSession(sessionId)}`, { e });
    }
  }
  try {
    state.sock.end(undefined);
    logger.info("WHATSAPP", `Pairing liberado: ${formatSession(sessionId)}`);
  } catch (err) {
    logger.error("WHATSAPP", `Erro ao liberar pairing: ${formatSession(sessionId)}`, err);
  }
}

export async function restartClient(sessionId: string): Promise<void> {
  await destroyClient(sessionId);
  await new Promise((r) => setTimeout(r, RESTART_DELAY_MS));
  await getOrCreateClient(sessionId);
}

/** Retorna o socket Baileys pronto para uso (enviar mensagem, buscar grupos, etc.). */
export function getReadyClient(sessionId: string): WASocket {
  const state = clients.get(sessionId);
  if (!state || !state.isReady) {
    throw new Error("WhatsApp não está conectado. Conecte escaneando o QR code.");
  }
  return state.sock;
}
