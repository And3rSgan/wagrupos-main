import { prisma } from "../prismaClient";

const DEFAULT_LIMITS = {
  connections: 1,
  campaigns: 50, // por dia
  users: 5,
  groups: 200, // total no sistema + max por campanha (usa o menor se groupsPerCampaign não existir)
  groupsPerCampaign: 200, // max grupos selecionáveis por campanha
};

type LimitKey = "connections" | "campaigns" | "users" | "groups" | "groupsPerCampaign";

export async function getCompanyLimits(companyId: string): Promise<Record<LimitKey, number>> {
  const sub = await prisma.subscription.findUnique({
    where: { companyId },
    include: { plan: true },
  });
  if (!sub?.plan?.limits) return { ...DEFAULT_LIMITS };
  const limits = sub.plan.limits as Record<string, number>;
  const groups = limits.groups ?? DEFAULT_LIMITS.groups;
  return {
    connections: limits.connections ?? DEFAULT_LIMITS.connections,
    campaigns: limits.campaigns ?? DEFAULT_LIMITS.campaigns,
    users: limits.users ?? DEFAULT_LIMITS.users,
    groups,
    groupsPerCampaign: limits.groupsPerCampaign ?? limits.groups ?? DEFAULT_LIMITS.groupsPerCampaign,
  };
}

/** Sem subscription = sem limite (empresa criada pelo SuperAdmin sem plano). */
export async function checkLimit(
  companyId: string,
  resource: LimitKey
): Promise<{ allowed: boolean; used: number; limit: number; message?: string }> {
  const sub = await prisma.subscription.findUnique({
    where: { companyId },
    include: { plan: true },
  });
  if (!sub?.plan) {
    return { allowed: true, used: 0, limit: 999999 };
  }

  const planLimits = (sub.plan.limits as Record<string, number>) ?? {};
  const limit = planLimits[resource] ?? (DEFAULT_LIMITS as Record<string, number>)[resource];

  let used = 0;
  switch (resource) {
    case "connections":
      used = await prisma.whatsappSession.count({ where: { companyId } });
      break;
    case "users":
      used = await prisma.user.count({ where: { companyId } });
      break;
    case "campaigns":
      used = await prisma.campaign.count({
        where: { user: { companyId } },
      });
      break;
    case "groups":
      used = await prisma.whatsappGroup.count({
        where: { session: { companyId } },
      });
      break;
    case "groupsPerCampaign":
      return { allowed: true, used: 0, limit: limit ?? 200 };
  }

  const allowed = used < limit;
  const labels: Record<string, string> = {
    connections: "Conexões WhatsApp",
    campaigns: "Campanhas",
    users: "Usuários",
    groups: "Grupos",
  };
  const message = allowed
    ? undefined
    : `Limite do plano atingido: ${labels[resource]} (${used}/${limit}). Faça upgrade para adicionar mais.`;

  return { allowed, used, limit, message };
}

export async function assertWithinLimit(companyId: string, resource: LimitKey): Promise<void> {
  const { allowed, message } = await checkLimit(companyId, resource);
  if (!allowed) throw new Error(message);
}

/** Limite de campanhas enviadas POR DIA. Zera à meia-noite UTC. */
export async function checkCampaignsPerDay(companyId: string): Promise<{
  allowed: boolean;
  usedToday: number;
  limit: number;
  message?: string;
}> {
  return checkGroupSendsPerDay(companyId);
}

/** Limite de envios para grupos POR DIA (campanhas "enviar agora" + disparos diretos). Bloqueia qualquer envio ao atingir o limite. */
export async function checkGroupSendsPerDay(companyId: string): Promise<{
  allowed: boolean;
  usedToday: number;
  limit: number;
  message?: string;
}> {
  const limits = await getCompanyLimits(companyId);
  const limit = limits.campaigns;

  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

  const [campaignsSentToday, directSendsToday] = await Promise.all([
    prisma.campaign.count({
      where: {
        user: { companyId },
        status: "sent",
        sentAt: { gte: startOfDay, lt: endOfDay },
      },
    }),
    prisma.messageSend.count({
      where: {
        group: { session: { companyId } },
        campaignId: null,
        status: "sent",
        createdAt: { gte: startOfDay, lt: endOfDay },
      },
    }),
  ]);

  const usedToday = campaignsSentToday + directSendsToday;
  const allowed = usedToday < limit;
  const message = allowed
    ? undefined
    : `Limite diário atingido: ${usedToday}/${limit} envios para grupos hoje. Amanhã será liberado novamente.`;

  return { allowed, usedToday, limit, message };
}

export async function assertCampaignsPerDay(companyId: string): Promise<void> {
  const { allowed, message } = await checkGroupSendsPerDay(companyId);
  if (!allowed) throw new Error(message);
}

/** @param extraSends Número de envios que serão feitos nesta requisição (ex.: vários grupos). */
export async function assertGroupSendsPerDay(companyId: string, extraSends: number = 1): Promise<void> {
  const { usedToday, limit, message } = await checkGroupSendsPerDay(companyId);
  const allowed = usedToday + extraSends <= limit;
  if (!allowed) throw new Error(message ?? `Limite diário atingido: ${usedToday}/${limit} envios para grupos hoje.`);
}

/** Limite de grupos por campanha. Bloqueia se groupCount > limite do plano. */
export async function assertCampaignGroupsLimit(companyId: string, groupCount: number): Promise<void> {
  const limits = await getCompanyLimits(companyId);
  const maxGroups = limits.groupsPerCampaign;
  if (groupCount > maxGroups) {
    throw new Error(
      `Limite do plano: você pode selecionar no máximo ${maxGroups} grupo(s) por campanha. Selecionou ${groupCount}.`
    );
  }
}
