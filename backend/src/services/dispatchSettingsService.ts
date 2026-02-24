/**
 * Configuração de delay dos disparos (campanhas, agendamento).
 * Presets: Seguro (recomendado), Equilibrado, Rápido.
 */
import { prisma } from "../prismaClient";

export type DispatchPreset = "seguro" | "equilibrado" | "rapido";

export interface DispatchSettingsResolved {
  delayMinSec: number;
  delayMaxSec: number;
  batchSize: number;
  pauseBetweenBatchesSec: number;
  preset: DispatchPreset;
  estimatedPerHour: number;
  /** Data em que a empresa aceitou o termo de uso de API terceira (disparos). */
  apiTermsAcceptedAt: string | null;
}

export interface DispatchSettingsInput {
  preset?: DispatchPreset;
  delayMinSec?: number;
  delayMaxSec?: number;
  batchSize?: number;
  pauseBetweenBatchesSec?: number;
  /** Se true, marca que a empresa aceitou o termo de uso de API terceira. */
  acceptApiTerms?: boolean;
}

const PRESETS: Record<DispatchPreset, DispatchSettingsResolved> = {
  seguro: {
    delayMinSec: 12,
    delayMaxSec: 25,
    batchSize: 15,
    pauseBetweenBatchesSec: 120,
    preset: "seguro",
    estimatedPerHour: 120,
    apiTermsAcceptedAt: null,
  },
  equilibrado: {
    delayMinSec: 8,
    delayMaxSec: 15,
    batchSize: 20,
    pauseBetweenBatchesSec: 90,
    preset: "equilibrado",
    estimatedPerHour: 180,
    apiTermsAcceptedAt: null,
  },
  rapido: {
    delayMinSec: 5,
    delayMaxSec: 10,
    batchSize: 25,
    pauseBetweenBatchesSec: 60,
    preset: "rapido",
    estimatedPerHour: 240,
    apiTermsAcceptedAt: null,
  },
};

const DEFAULT_PRESET: DispatchPreset = "seguro";

function parseStored(raw: unknown): (DispatchSettingsInput & { apiTermsAcceptedAt?: string | null }) | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const preset = o.preset as DispatchPreset | undefined;
  const apiTermsAcceptedAt = typeof o.apiTermsAcceptedAt === "string" ? o.apiTermsAcceptedAt : null;
  if (preset && (preset === "seguro" || preset === "equilibrado" || preset === "rapido")) {
    return {
      preset,
      delayMinSec: typeof o.delayMinSec === "number" ? o.delayMinSec : undefined,
      delayMaxSec: typeof o.delayMaxSec === "number" ? o.delayMaxSec : undefined,
      batchSize: typeof o.batchSize === "number" ? o.batchSize : undefined,
      pauseBetweenBatchesSec: typeof o.pauseBetweenBatchesSec === "number" ? o.pauseBetweenBatchesSec : undefined,
      apiTermsAcceptedAt: apiTermsAcceptedAt || undefined,
    };
  }
  return { apiTermsAcceptedAt: apiTermsAcceptedAt || undefined };
}

/** Retorna configuração resolvida para uso no envio (delay entre mensagens, lote, pausa). */
export function getResolvedDispatchSettings(companyId: string): Promise<DispatchSettingsResolved> {
  return prisma.company.findUnique({ where: { id: companyId }, select: { dispatchSettings: true } }).then((c) => {
    const stored = parseStored(c?.dispatchSettings ?? null);
    const preset = stored?.preset ?? DEFAULT_PRESET;
    const base = PRESETS[preset];
    return {
      delayMinSec: stored?.delayMinSec ?? base.delayMinSec,
      delayMaxSec: stored?.delayMaxSec ?? base.delayMaxSec,
      batchSize: stored?.batchSize ?? base.batchSize,
      pauseBetweenBatchesSec: stored?.pauseBetweenBatchesSec ?? base.pauseBetweenBatchesSec,
      preset: base.preset,
      estimatedPerHour: base.estimatedPerHour,
      apiTermsAcceptedAt: stored?.apiTermsAcceptedAt ?? null,
    };
  });
}

/** Retorna configuração para exibição no painel (preset atual + valores + apiTermsAcceptedAt). */
export async function getDispatchSettings(companyId: string): Promise<DispatchSettingsResolved & { preset: DispatchPreset }> {
  const resolved = await getResolvedDispatchSettings(companyId);
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { dispatchSettings: true } });
  const stored = parseStored(company?.dispatchSettings ?? null);
  const preset = stored?.preset ?? DEFAULT_PRESET;
  const base = PRESETS[preset];
  return {
    ...resolved,
    preset,
    estimatedPerHour: base.estimatedPerHour,
    apiTermsAcceptedAt: resolved.apiTermsAcceptedAt ?? null,
  };
}

/** Salva configuração (preset ou valores custom). Se acceptApiTerms for true, grava a data de aceite. */
export async function setDispatchSettings(companyId: string, data: DispatchSettingsInput): Promise<DispatchSettingsResolved> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { dispatchSettings: true } });
  const stored = parseStored(company?.dispatchSettings ?? null);
  const preset = data.preset ?? (stored?.preset as DispatchPreset | undefined) ?? DEFAULT_PRESET;
  const base = PRESETS[preset];
  const apiTermsAcceptedAt = data.acceptApiTerms === true ? new Date().toISOString() : (stored?.apiTermsAcceptedAt ?? null);
  const payload = {
    preset,
    delayMinSec: data.delayMinSec ?? stored?.delayMinSec ?? base.delayMinSec,
    delayMaxSec: data.delayMaxSec ?? stored?.delayMaxSec ?? base.delayMaxSec,
    batchSize: data.batchSize ?? stored?.batchSize ?? base.batchSize,
    pauseBetweenBatchesSec: data.pauseBetweenBatchesSec ?? stored?.pauseBetweenBatchesSec ?? base.pauseBetweenBatchesSec,
    apiTermsAcceptedAt: apiTermsAcceptedAt ?? undefined,
  };
  await prisma.company.update({
    where: { id: companyId },
    data: { dispatchSettings: payload as object },
  });
  return getResolvedDispatchSettings(companyId);
}

export { PRESETS };
