import { Router } from "express";
import { z } from "zod";
import { authMiddleware, enrichAuth, AuthRequest } from "../middleware/auth";
import { prisma } from "../prismaClient";
import { productImageUpload, getFilePathForDb } from "../utils/multerCompanyUpload";

const router = Router();
router.use(authMiddleware);
router.use(async (req, _res, next) => {
  await enrichAuth(req as AuthRequest);
  next();
});

router.get("/", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const items = await prisma.product.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });
  res.json(items);
});

router.get("/:id", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const item = await prisma.product.findFirst({
    where: { id: req.params.id, userId },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });
  if (!item) return res.status(404).json({ message: "Produto não encontrado" });
  res.json(item);
});

router.post("/", productImageUpload.array("images", 10), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const schema = z.object({
      title: z.string().min(1),
      price: z.string().min(1),
      oldPrice: z.string().optional(),
      discountPercent: z.coerce.number().optional(),
      coupon: z.string().optional(),
      link: z.string().optional(),
      store: z.string().optional(),
      category: z.string().optional(),
      tags: z.string().optional(),
      validUntil: z.string().optional(),
      status: z.enum(["active", "expired"]).optional().default("active"),
    });
    const body = schema.parse(req.body);
    const files = req.files as Express.Multer.File[] | undefined;

    const validUntil = body.validUntil ? new Date(body.validUntil) : undefined;

    const product = await prisma.product.create({
      data: {
        userId,
        title: body.title,
        price: body.price,
        oldPrice: body.oldPrice || undefined,
        discountPercent: body.discountPercent,
        coupon: body.coupon || undefined,
        link: body.link || undefined,
        store: body.store || undefined,
        category: body.category || undefined,
        tags: body.tags || undefined,
        validUntil,
        status: body.status,
      },
    });

    if (files?.length) {
      await prisma.productImage.createMany({
        data: files.map((f, i) => ({
          productId: product.id,
          filePath: getFilePathForDb(req, f.filename),
          type: f.mimetype.startsWith("video/") ? "video" : "image",
          sortOrder: i,
        })),
      });
    }

    const created = await prisma.product.findUnique({
      where: { id: product.id },
      include: { images: true },
    });
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Erro ao criar produto" });
  }
});

router.put("/:id", productImageUpload.array("images", 10), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const schema = z.object({
      title: z.string().min(1).optional(),
      price: z.string().optional(),
      oldPrice: z.string().optional(),
      discountPercent: z.coerce.number().optional(),
      coupon: z.string().optional(),
      link: z.string().optional(),
      store: z.string().optional(),
      category: z.string().optional(),
      tags: z.string().optional(),
      validUntil: z.string().optional(),
      status: z.enum(["active", "expired"]).optional(),
    });
    const body = schema.parse(req.body);
    const files = req.files as Express.Multer.File[] | undefined;

    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) return res.status(404).json({ message: "Produto não encontrado" });

    const validUntil = body.validUntil !== undefined ? (body.validUntil ? new Date(body.validUntil) : null) : undefined;

    await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(body.title != null && { title: body.title }),
        ...(body.price != null && { price: body.price }),
        ...(body.oldPrice !== undefined && { oldPrice: body.oldPrice || null }),
        ...(body.discountPercent !== undefined && { discountPercent: body.discountPercent }),
        ...(body.coupon !== undefined && { coupon: body.coupon || null }),
        ...(body.link !== undefined && { link: body.link || null }),
        ...(body.store !== undefined && { store: body.store || null }),
        ...(body.category !== undefined && { category: body.category || null }),
        ...(body.tags !== undefined && { tags: body.tags || null }),
        ...(validUntil !== undefined && { validUntil }),
        ...(body.status != null && { status: body.status }),
      },
    });

    if (files?.length) {
      const maxOrder = await prisma.productImage.aggregate({
        where: { productId: req.params.id },
        _max: { sortOrder: true },
      });
      const startOrder = (maxOrder._max.sortOrder ?? -1) + 1;
      await prisma.productImage.createMany({
        data: files.map((f, i) => ({
          productId: req.params.id,
          filePath: getFilePathForDb(req, f.filename),
          type: f.mimetype.startsWith("video/") ? "video" : "image",
          sortOrder: startOrder + i,
        })),
      });
    }

    const updated = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Erro ao atualizar produto" });
  }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) return res.status(404).json({ message: "Produto não encontrado" });
    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Erro ao remover produto" });
  }
});

export default router;
