import { Router } from "express";
import { z } from "zod";
import { authMiddleware, AuthRequest, superAdminMiddleware } from "../middleware/auth";
import { prisma } from "../prismaClient";

const router = Router();
router.use(authMiddleware);
router.use(superAdminMiddleware);

router.get("/", async (_req, res) => {
  const list = await prisma.company.findMany({
    orderBy: { name: "asc" },
    include: {
      subscription: {
        include: { plan: true },
      },
      _count: { select: { users: true } },
    },
  });
  res.json(list);
});

/** SuperAdmin: desconectar uma sessão WhatsApp de qualquer empresa (antes de /:id) */
router.post("/sessions/:sessionId/disconnect", async (req, res) => {
  try {
    const session = await prisma.whatsappSession.findUnique({
      where: { id: req.params.sessionId },
    });
    if (!session) return res.status(404).json({ message: "Sessão não encontrada" });
    const { destroyClient } = await import("../services/whatsappClientManager");
    await destroyClient(session.id);
    await prisma.whatsappSession.update({
      where: { id: session.id },
      data: { status: "disconnected" },
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message ?? "Erro ao desconectar" });
  }
});

/** Detalhe da empresa: usuários, conexões WhatsApp (sessões são da empresa, não do usuário) */
router.get("/:id", async (req, res) => {
  const company = await prisma.company.findUnique({
    where: { id: req.params.id },
    include: {
      subscription: { include: { plan: true } },
      users: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      },
      whatsappSessions: {
        select: {
          id: true,
          name: true,
          status: true,
          waPushName: true,
          waPhone: true,
          waAvatarUrl: true,
          lastConnectedAt: true,
          isDefault: true,
        },
      },
    },
  });
  if (!company) return res.status(404).json({ message: "Empresa não encontrada" });
  const { isClientReady } = await import("../services/whatsappClientManager");
  const sessionsWithStatus = company.whatsappSessions.map((s) => ({
    ...s,
    status: isClientReady(s.id) ? "connected" : s.status,
  }));
  res.json({ ...company, whatsappSessions: sessionsWithStatus });
});

router.post("/", async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      document: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const existing = await prisma.company.findUnique({ where: { slug: data.slug } });
    if (existing) return res.status(400).json({ message: "Slug já existe" });

    const company = await prisma.company.create({
      data,
    });
    await prisma.whatsappSession.create({
      data: { companyId: company.id, name: "Conexão Principal", isDefault: true },
    });
    const companyWithSession = await prisma.company.findUnique({
      where: { id: company.id },
      include: { _count: { select: { whatsappSessions: true } } },
    });
    res.status(201).json(companyWithSession ?? company);
  } catch (err: any) {
    res.status(400).json({ message: err.message ?? "Erro ao criar empresa" });
  }
});

/** SuperAdmin: desativar empresa */
router.post("/:id/deactivate", async (req, res) => {
  try {
    const company = await prisma.company.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json(company);
  } catch (err: any) {
    if (err?.code === "P2025") return res.status(404).json({ message: "Empresa não encontrada" });
    res.status(400).json({ message: err.message ?? "Erro ao desativar" });
  }
});

/** SuperAdmin: reativar empresa */
router.post("/:id/activate", async (req, res) => {
  try {
    const company = await prisma.company.update({
      where: { id: req.params.id },
      data: { isActive: true },
    });
    res.json(company);
  } catch (err: any) {
    if (err?.code === "P2025") return res.status(404).json({ message: "Empresa não encontrada" });
    res.status(400).json({ message: err.message ?? "Erro ao reativar" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2).optional(),
      slug: z.string().min(2).regex(/^[a-z0-9-]+$/).optional(),
      email: z.string().email().nullable().optional(),
      phone: z.string().nullable().optional(),
      document: z.string().nullable().optional(),
      isActive: z.boolean().optional(),
    });
    const data = schema.parse(req.body);
    const company = await prisma.company.update({
      where: { id: req.params.id },
      data,
    });
    res.json(company);
  } catch (err: any) {
    res.status(400).json({ message: err.message ?? "Erro ao atualizar" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.company.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err: any) {
    if (err?.code === "P2025") return res.status(404).json({ message: "Empresa não encontrada" });
    res.status(400).json({ message: err.message ?? "Erro ao remover" });
  }
});

export default router;
