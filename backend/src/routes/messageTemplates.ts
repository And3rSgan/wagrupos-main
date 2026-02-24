import { Router } from "express";
import { z } from "zod";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { prisma } from "../prismaClient";
import { DEFAULT_TEMPLATES } from "../services/messageGeneratorService";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const custom = await prisma.messageTemplate.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  res.json({ builtin: DEFAULT_TEMPLATES, custom });
});

router.post("/generate", async (req: AuthRequest, res) => {
  try {
    const { generateMessage } = await import("../services/messageGeneratorService");
    const schema = z.object({
      templateBody: z.string().min(1),
      productId: z.string().optional(),
      seed: z.number().optional(),
    });
    const { templateBody, productId, seed } = schema.parse(req.body);
    const userId = req.userId!;

    let product: { title: string; price: string; oldPrice?: string; discountPercent?: number; coupon?: string; link?: string; store?: string; category?: string } | null = null;
    if (productId) {
      const p = await prisma.product.findFirst({
        where: { id: productId, userId },
      });
      if (p)
        product = {
          title: p.title,
          price: p.price,
          oldPrice: p.oldPrice ?? undefined,
          discountPercent: p.discountPercent ?? undefined,
          coupon: p.coupon ?? undefined,
          link: p.link ?? undefined,
          store: p.store ?? undefined,
          category: p.category ?? undefined,
        };
    }

    const message = generateMessage(templateBody, product, seed);
    res.json({ message });
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Erro ao gerar mensagem" });
  }
});

router.post("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const schema = z.object({
      name: z.string().min(1),
      templateType: z.string(),
      body: z.string().min(1),
      cta: z.string().optional(),
    });
    const body = schema.parse(req.body);
    const template = await prisma.messageTemplate.create({
      data: { userId, ...body },
    });
    res.status(201).json(template);
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Erro ao criar template" });
  }
});

router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const schema = z.object({
      name: z.string().min(1).optional(),
      templateType: z.string().optional(),
      body: z.string().min(1).optional(),
      cta: z.string().optional(),
    });
    const body = schema.parse(req.body);
    const existing = await prisma.messageTemplate.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) return res.status(404).json({ message: "Template não encontrado" });
    const template = await prisma.messageTemplate.update({
      where: { id: req.params.id },
      data: body,
    });
    res.json(template);
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Erro ao atualizar template" });
  }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const existing = await prisma.messageTemplate.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) return res.status(404).json({ message: "Template não encontrado" });
    await prisma.messageTemplate.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Erro ao remover template" });
  }
});

export default router;
