import { Router } from "express";
import { z } from "zod";
import { authMiddleware, superAdminMiddleware } from "../middleware/auth";
import { prisma } from "../prismaClient";

const router = Router();

/** Lista planos ativos (público - usado no registro). Exclui vitalício (só para SuperAdmin). */
router.get("/public", async (_req, res) => {
  const list = await prisma.plan.findMany({
    where: {
      isActive: true,
      slug: { not: "vitalicio" },
    },
    orderBy: { price: "asc" },
    select: { id: true, name: true, slug: true, price: true, limits: true },
  });
  res.json(list);
});

router.use(authMiddleware);
router.use(superAdminMiddleware);

const defaultLimits = {
  connections: 1,
  campaigns: 50,
  users: 5,
  groups: 200,
};

router.get("/", async (_req, res) => {
  const list = await prisma.plan.findMany({
    orderBy: { price: "asc" },
    include: { _count: { select: { subscriptions: true } } },
  });
  res.json(list);
});

router.post("/", async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
      price: z.number().min(0),
      limits: z
        .object({
          connections: z.number().int().min(0).optional(),
          campaigns: z.number().int().min(0).optional(),
          users: z.number().int().min(0).optional(),
          groups: z.number().int().min(0).optional(),
        })
        .optional(),
    });
    const data = schema.parse(req.body);

    const existing = await prisma.plan.findUnique({ where: { slug: data.slug } });
    if (existing) return res.status(400).json({ message: "Slug já existe" });

    const limits = { ...defaultLimits, ...data.limits };
    const plan = await prisma.plan.create({
      data: {
        name: data.name,
        slug: data.slug,
        price: data.price,
        limits: limits as any,
      },
    });
    res.status(201).json(plan);
  } catch (err: any) {
    res.status(400).json({ message: err.message ?? "Erro ao criar plano" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2).optional(),
      slug: z.string().min(2).regex(/^[a-z0-9-]+$/).optional(),
      price: z.number().min(0).optional(),
      limits: z.record(z.any()).optional(),
      isActive: z.boolean().optional(),
    });
    const data = schema.parse(req.body);
    const plan = await prisma.plan.update({
      where: { id: req.params.id },
      data: data as any,
    });
    res.json(plan);
  } catch (err: any) {
    res.status(400).json({ message: err.message ?? "Erro ao atualizar" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const subs = await prisma.subscription.count({ where: { planId: req.params.id } });
    if (subs > 0) {
      return res.status(400).json({ message: "Plano em uso. Desative-o em vez de excluir." });
    }
    await prisma.plan.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message ?? "Erro ao remover" });
  }
});

export default router;
