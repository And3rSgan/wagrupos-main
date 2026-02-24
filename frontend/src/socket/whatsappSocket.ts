/**
 * Socket.io client para eventos WhatsApp em tempo real.
 * Conecta apenas quando há token e emite/escuta eventos de forma isolada por sessão.
 */
import { io, Socket } from "socket.io-client";
import { getBackendBaseUrl } from "../api";

let socket: Socket | null = null;

function getSocket(): Socket | null {
  const token = window.localStorage.getItem("auth_token");
  if (!token) return null;

  if (socket?.connected) return socket;

  const baseUrl = getBackendBaseUrl();
  const url = baseUrl.startsWith("http") ? baseUrl : `${window.location.protocol}//${window.location.host}`;

  socket = io(url, {
    path: "/socket.io",
    auth: { token },
    transports: ["websocket", "polling"],
  });

  socket.on("connect_error", () => {
    socket = null;
  });

  socket.on("disconnect", () => {
    if (socket && !socket.connected) socket = null;
  });

  return socket;
}

/** Entra na room da sessão para receber eventos (QR, ready, etc.). Valida no servidor. */
export function joinSessionRoom(sessionId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const s = getSocket();
    if (!s) {
      resolve(false);
      return;
    }
    s.emit("join_session", sessionId, (ok: boolean) => resolve(ok ?? false));
  });
}

/** Sai da room da sessão. */
export function leaveSessionRoom(sessionId: string): void {
  getSocket()?.emit("leave_session", sessionId);
}

/** Escuta evento de QR gerado. */
export function onQr(cb: (sessionId: string, qr: string) => void): () => void {
  const s = getSocket();
  if (!s) return () => {};

  const handler = (data: { sessionId: string; qr?: string }) => {
    if (data?.sessionId && data?.qr) cb(data.sessionId, data.qr);
  };
  s.on("whatsapp:qr", handler);
  return () => s.off("whatsapp:qr", handler);
}

/** Escuta evento de conexão pronta. */
export function onReady(cb: (sessionId: string) => void): () => void {
  const s = getSocket();
  if (!s) return () => {};

  const handler = (data: { sessionId: string }) => {
    if (data?.sessionId) cb(data.sessionId);
  };
  s.on("whatsapp:ready", handler);
  return () => s.off("whatsapp:ready", handler);
}

/** Escuta evento de desconexão. */
export function onDisconnected(cb: (sessionId: string) => void): () => void {
  const s = getSocket();
  if (!s) return () => {};

  const handler = (data: { sessionId: string }) => {
    if (data?.sessionId) cb(data.sessionId);
  };
  s.on("whatsapp:disconnected", handler);
  return () => s.off("whatsapp:disconnected", handler);
}

/** Escuta evento de falha de autenticação. */
export function onAuthFailure(cb: (sessionId: string) => void): () => void {
  const s = getSocket();
  if (!s) return () => {};

  const handler = (data: { sessionId: string }) => {
    if (data?.sessionId) cb(data.sessionId);
  };
  s.on("whatsapp:auth_failure", handler);
  return () => s.off("whatsapp:auth_failure", handler);
}
