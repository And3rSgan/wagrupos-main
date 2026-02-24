import bcrypt from "bcryptjs";
import { prisma } from "../prismaClient";
import { logger } from "../utils/logger";

async function getOrCreateSistemaCompany() {
  let company = await prisma.company.findUnique({
    where: { slug: "sistema-administrativo" },
  });
  if (company) return company.id;

  const plan = await prisma.plan.findFirst({
    where: { slug: "vitalicio" },
  }) ?? await prisma.plan.create({
    data: { name: "Vitalício", slug: "vitalicio", price: 0, limits: {} },
  });

  const now = new Date();
  const periodEnd = new Date("2093-12-31");

  company = await prisma.company.create({
    data: {
      id: "company-superadmin-sistema",
      name: "Sistema Administrativo",
      slug: "sistema-administrativo",
      isActive: true,
    },
  });
  await prisma.subscription.create({
    data: {
      companyId: company.id,
      planId: plan.id,
      status: "active",
      billingDay: 1,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });
  return company.id;
}

async function run() {
  const email = (process.env.ADMIN_EMAIL || "admin@admin.com").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "123456";
  const name = (process.env.ADMIN_NAME || "Administrador").trim();

  if (password.length < 6) {
    throw new Error("ADMIN_PASSWORD precisa ter pelo menos 6 caracteres.");
  }

  const sistemaCompanyId = await getOrCreateSistemaCompany();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "SUPERADMIN") {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: "SUPERADMIN",
          name: existing.name ?? name,
          companyId: sistemaCompanyId,
        },
      });
      logger.success("SEED", `Usuario promovido para SUPERADMIN: ${email}`);
      return;
    }
    if (!existing.companyId || existing.companyId !== sistemaCompanyId) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { companyId: sistemaCompanyId },
      });
      logger.success("SEED", `Admin vinculado a Sistema Administrativo: ${email}`);
    }
    logger.info("SEED", `Admin ja existe: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: "SUPERADMIN",
      companyId: sistemaCompanyId,
    },
  });

  logger.success("SEED", `Admin criado: ${email}`);
}

run()
  .catch((err) => {
    logger.error("SEED", "Falha ao criar admin inicial", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

