import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prismaClient";
import { env } from "../config/env";

export async function registerUser(data: {
  email: string;
  password: string;
  name?: string;
  companyName: string;
  planId: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new Error("E-mail já cadastrado");
  }

  const slug = data.companyName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  if (!slug) throw new Error("Nome da empresa inválido");

  const existingSlug = await prisma.company.findUnique({ where: { slug } });
  if (existingSlug) {
    throw new Error("Já existe uma empresa com esse nome. Use um nome diferente.");
  }

  const plan = await prisma.plan.findFirst({
    where: { id: data.planId, isActive: true },
  });
  if (!plan) {
    throw new Error("Plano inválido ou inativo");
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const { getSetting } = await import("./systemSettingService");
  const trialDays = parseInt((await getSetting("trial_days")) || "0", 10) || 0;
  const now = new Date();
  const billingDay = Math.min(28, Math.max(1, now.getDate()));
  const trialEndsAt = trialDays > 0 ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000) : null;
  // Durante o trial: currentPeriodEnd = fim do trial. Após pagar, webhook renova para o mês seguinte.
  const periodEnd = trialEndsAt ?? new Date(now.getFullYear(), now.getMonth() + 1, billingDay);

  const [user] = await prisma.$transaction([
    prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
        role: "ADMIN",
        company: {
          create: {
            name: data.companyName,
            slug,
            email: data.email,
            subscription: {
              create: {
                planId: plan.id,
                billingDay,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                trialEndsAt,
              },
            },
            whatsappSessions: {
              create: { name: "Conexão Principal", isDefault: true },
            },
          },
        },
      },
      include: { company: { include: { subscription: { include: { plan: true } } } } },
    }),
  ]);

  // Cria fatura inicial para o cliente poder pagar quando o trial acabar
  if (trialEndsAt && user.company?.subscription) {
    const dueDate = new Date(trialEndsAt);
    dueDate.setDate(dueDate.getDate() + 2); // 2 dias após fim do trial para pagar
    await prisma.invoice.create({
      data: {
        companyId: user.company.id,
        subscriptionId: user.company.subscription.id,
        amount: plan.price,
        status: "pending",
        dueDate,
      },
    });
  }

  return user;
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { company: true },
  });
  if (!user) {
    throw new Error("Credenciais inválidas");
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new Error("Credenciais inválidas");
  }

  if (user.companyId && user.company && user.company.isActive === false) {
    throw new Error("Empresa desativada. Entre em contato com o suporte.");
  }

  if (user.role === "SUPERADMIN" && !user.companyId) {
    const sist = await prisma.company.findFirst({
      where: { slug: "sistema-administrativo" },
    });
    if (sist) {
      await prisma.user.update({
        where: { id: user.id },
        data: { companyId: sist.id },
      });
      user.companyId = sist.id;
      user.company = sist;
    }
  }

  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId ?? undefined,
    },
    env.jwtSecret,
    { expiresIn: "7d" }
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      company: user.company
        ? { id: user.company.id, name: user.company.name, slug: user.company.slug }
        : null,
    },
    token,
  };
}

export async function bootstrapAdmin(
  email: string,
  password: string,
  name?: string
) {
  const count = await prisma.user.count();
  if (count > 0) {
    throw new Error("Bootstrap já foi executado");
  }
  let sistemCompany = await prisma.company.findFirst({
    where: { slug: "sistema-administrativo" },
  });
  if (!sistemCompany) {
    const plan = await prisma.plan.findFirst({ where: { slug: "vitalicio" } })
      ?? await prisma.plan.create({ data: { name: "Vitalício", slug: "vitalicio", price: 0, limits: {} } });
    sistemCompany = await prisma.company.create({
      data: {
        id: "company-superadmin-sistema",
        name: "Sistema Administrativo",
        slug: "sistema-administrativo",
        isActive: true,
      },
    });
    await prisma.subscription.create({
      data: {
        companyId: sistemCompany.id,
        planId: plan.id,
        status: "active",
        billingDay: 1,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date("2093-12-31"),
      },
    });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "SUPERADMIN",
      name: name ?? "Super Admin",
      companyId: sistemCompany.id,
    },
  });
  return user;
}
