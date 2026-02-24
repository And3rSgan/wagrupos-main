/**
 * Auth state do Baileys/libzapitu persistido no Postgres via Prisma.
 * Substitui useMultiFileAuthState (pasta baileys_auth).
 */
import { prisma } from "../prismaClient";

/** Delegate do modelo WhatsappAuthState (use após `npx prisma generate`). */
type WhatsappAuthStateDelegate = {
  upsert(args: {
    where: { sessionId_key: { sessionId: string; key: string } };
    create: { sessionId: string; key: string; value: object };
    update: { value: object };
  }): Promise<unknown>;
  findUnique(args: { where: { sessionId_key: { sessionId: string; key: string } } }): Promise<{ value: unknown } | null>;
  deleteMany(args: { where: { sessionId?: string; key?: string } }): Promise<unknown>;
};

const db = prisma as typeof prisma & { whatsappAuthState: WhatsappAuthStateDelegate };

/** Serialização de Buffer em JSON (compatível com Baileys). */
const BufferJSON = {
  replacer: (_k: string, v: unknown): unknown => {
    if (Buffer.isBuffer(v)) {
      return { type: "Buffer", data: Array.from(v) };
    }
    return v;
  },
  reviver: (_k: string, v: unknown): unknown => {
    if (v && typeof v === "object" && "type" in v && (v as { type: string }).type === "Buffer" && "data" in v) {
      return Buffer.from((v as { data: number[] }).data);
    }
    return v;
  },
};

function fixFileName(file?: string): string | null {
  if (!file) return null;
  return file.replace(/\//g, "__").replace(/:/g, "-");
}

/** Estado de autenticação compatível com makeWASocket({ auth }). */
export interface WaAuthState {
  creds: Record<string, unknown>;
  keys: {
    get: (type: string, ids: string[]) => Promise<Record<string, unknown>>;
    set: (data: Record<string, Record<string, unknown>>) => Promise<void>;
  };
}

/**
 * Retorna estado de autenticação e saveCreds usando a tabela WhatsappAuthState.
 * Interface compatível com useMultiFileAuthState para makeWASocket({ auth: state }).
 */
export async function usePrismaAuthState(sessionId: string): Promise<{
  state: WaAuthState;
  saveCreds: () => Promise<void>;
}> {
  const writeData = async (data: unknown, file: string): Promise<void> => {
    const key = fixFileName(file) ?? file;
    const value = JSON.parse(JSON.stringify(data, BufferJSON.replacer)) as object;
    await db.whatsappAuthState.upsert({
      where: { sessionId_key: { sessionId, key } },
      create: { sessionId, key, value },
      update: { value },
    });
  };

  const readData = async (file: string): Promise<unknown | null> => {
    const key = fixFileName(file) ?? file;
    const row = await db.whatsappAuthState.findUnique({
      where: { sessionId_key: { sessionId, key } },
    });
    if (!row || row.value == null) return null;
    return JSON.parse(JSON.stringify(row.value), BufferJSON.reviver);
  };

  const removeData = async (file: string): Promise<void> => {
    const key = fixFileName(file) ?? file;
    await db.whatsappAuthState.deleteMany({
      where: { sessionId, key },
    });
  };

  const { initAuthCreds, proto } = await import("libzapitu-rf");

  const creds =
    ((await readData("creds.json")) as Record<string, unknown> | null) || (initAuthCreds() as Record<string, unknown>);

  const state: WaAuthState = {
    creds,
    keys: {
      get: async (type: string, ids: string[]) => {
        const data: Record<string, unknown> = {};
        await Promise.all(
          ids.map(async (id) => {
            let value = await readData(`${type}-${id}.json`);
            if (type === "app-state-sync-key" && value && proto?.Message?.AppStateSyncKeyData) {
              value = (proto.Message.AppStateSyncKeyData as { fromObject: (o: Record<string, unknown>) => unknown }).fromObject(value as Record<string, unknown>);
            }
            data[id] = value;
          })
        );
        return data;
      },
      set: async (data: Record<string, Record<string, unknown>>) => {
        const tasks: Promise<unknown>[] = [];
        for (const category of Object.keys(data)) {
          for (const id of Object.keys(data[category])) {
            const value = data[category][id];
            const file = `${category}-${id}.json`;
            tasks.push(value ? writeData(value, file) : removeData(file));
          }
        }
        await Promise.all(tasks);
      },
    },
  };

  const saveCreds = async (): Promise<void> => {
    await writeData(creds, "creds.json");
  };

  return { state, saveCreds };
}

/** Remove todo o estado de autenticação de uma sessão (ex.: ao fazer logout). */
export async function clearPrismaAuthState(sessionId: string): Promise<void> {
  await db.whatsappAuthState.deleteMany({ where: { sessionId } });
}
