import type { Server } from "socket.io";

let ioInstance: Server | null = null;

export function setSocketIo(io: Server): void {
  ioInstance = io;
}

export function getSocketIo(): Server | null {
  return ioInstance;
}

export function emitInvoicePaid(companyId: string, payload: { invoiceId: string }): void {
  if (ioInstance) {
    ioInstance.to(`company:${companyId}`).emit("invoice:paid", payload);
  }
}
