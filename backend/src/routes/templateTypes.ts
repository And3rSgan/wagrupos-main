import { Router } from "express";
import { z } from "zod";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { prisma } from "../prismaClient";

const DEFAULT_TYPES = [
  { slug: "oferta_relampago", label: "Oferta Relâmpago", sortOrder: 0 },
  { slug: "cupom", label: "Cupom", sortOrder: 1 },
  { slug: "frete_gratis", label: "Frete Grátis", sortOrder: 2 },
  { slug: "custom", label: "Personalizado", sortOrder: 3 },
];

const router = Router();
router.use(authMiddleware);

router.get("/", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  let types = await prisma.templateType.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
  });
  if (types.length === 0) {
    await prisma.templateType.createMany({
      data: DEFAULT_TYPES.map((t) => ({ userId, ...t })),
    });
    types = await prisma.templateType.findMany({
      where: { userId },
      orderBy: { sortOrder: "asc" },
    });
  }
  res.json(types);
});

router.post("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const schema = z.object({
      slug: z.string().min(1).regex(/^[a-z0-9_]+$/, "Use apenas letras minúsculas, números e _"),
      label: z.string().min(1),
    });
    const body = schema.parse(req.body);
    const existing = await prisma.templateType.findUnique({
      where: { userId_slug: { userId, slug: body.slug } },
    });
    if (existing) return res.status(400).json({ message: "Já existe um tipo com este slug" });
    const maxOrder = await prisma.templateType.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });
    const type = await prisma.templateType.create({
      data: {
        userId,
        slug: body.slug,
        label: body.label,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
    res.status(201).json(type);
  } catch (err: any) {
    res.status(400).json({ message: err.message ?? "Erro ao criar tipo" });
  }
});

router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const schema = z.object({
      slug: z.string().min(1).regex(/^[a-z0-9_]+$/).optional(),
      label: z.string().min(1).optional(),
    });
    const body = schema.parse(req.body);
    const existing = await prisma.templateType.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) return res.status(404).json({ message: "Tipo não encontrado" });
    if (body.slug) {
      const dup = await prisma.templateType.findFirst({
        where: { userId, slug: body.slug, id: { not: req.params.id } },
      });
      if (dup) return res.status(400).json({ message: "Já existe um tipo com este slug" });
    }
    const type = await prisma.templateType.update({
      where: { id: req.params.id },
      data: body,
    });
    res.json(type);
  } catch (err: any) {
    res.status(400).json({ message: err.message ?? "Erro ao atualizar tipo" });
  }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const existing = await prisma.templateType.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) return res.status(404).json({ message: "Tipo não encontrado" });
    await prisma.templateType.delete({ where: { id: req.params.id } });
    await prisma.messageTemplate.updateMany({
      where: { userId, templateType: existing.slug },
      data: { templateType: "custom" },
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message ?? "Erro ao remover tipo" });
  }
});

export default router;
