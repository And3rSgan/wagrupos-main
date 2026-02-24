import { Router } from "express";
import { z } from "zod";
import { authMiddleware, enrichAuth, AuthRequest } from "../middleware/auth";
import { prisma } from "../prismaClient";
import { campaignImageUpload, getFilePathForDb } from "../utils/multerCompanyUpload";

const router = Router();
router.use(authMiddleware);
router.use(async (req, _res, next) => {
  await enrichAuth(req as AuthRequest);
  next();
});

router.get("/", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const items = await prisma.campaign.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { targets: { include: { group: true } }, product: true },
  });
  res.json(items);
});

/** Limites do plano para campanhas (campanhas/dia, grupos por campanha) */
router.get("/limits", async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.json({
        campaignsPerDay: { usedToday: 0, limit: 50 },
        groupsPerCampaign: 200,
      });
    }
    const { getCompanyLimits, checkCampaignsPerDay } = await import("../services/planLimitsService");
    const limits = await getCompanyLimits(companyId);
    const campaignsPerDay = await checkCampaignsPerDay(companyId);
    res.json({
      campaignsPerDay: { usedToday: campaignsPerDay.usedToday, limit: campaignsPerDay.limit },
      groupsPerCampaign: limits.groupsPerCampaign,
    });
  } catch (err: any) {
    res.status(400).json({ message: err?.message ?? "Erro ao obter limites" });
  }
});

router.post("/", campaignImageUpload.single("image"), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const schema = z.object({
      sessionId: z.string().optional(),
      title: z.string().min(2).optional(),
      messageText: z.string().min(1),
      productId: z.string().optional(),
      templateId: z.string().optional(),
      scheduledAt: z.string().optional(), // ISO date
      repeatRule: z.enum(["none", "daily", "weekly"]).optional().default("none"),
      linkUrl: z.preprocess(
        (v) => {
          if (v === null || v === undefined) return undefined;
          const s = String(v).trim();
          if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return undefined;
          return s;
        },
        z.string().url().optional()
      ),
      groupIds: z.string().min(1),
      sendNow: z.string().optional(),
      mentionAll: z.preprocess((v) => v === "true" || v === true, z.boolean().optional()).optional(),
    });

    const parsed = schema.parse(req.body);
    const scheduledAtParsed = parsed.scheduledAt ? new Date(parsed.scheduledAt) : undefined;
    const groupIds = parsed.groupIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!groupIds.length) return res.status(400).json({ message: "Selecione ao menos 1 grupo" });

    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ message: "Usuário precisa estar vinculado a uma empresa" });

    const { assertCampaignsPerDay, assertCampaignGroupsLimit } = await import("../services/planLimitsService");
    await assertCampaignGroupsLimit(companyId, groupIds.length);
    if (parsed.sendNow === "true") {
      await assertCampaignsPerDay(companyId);
    }

    const session =
      parsed.sessionId
        ? await prisma.whatsappSession.findFirst({
            where: { id: parsed.sessionId, companyId },
          })
        : await prisma.whatsappSession.findFirst({ where: { companyId } });

    if (!session) return res.status(400).json({ message: "Sessão WhatsApp não encontrada" });

    const imagePath = req.file ? getFilePathForDb(req, req.file.filename) : undefined;

    const existingGroups = await prisma.whatsappGroup.findMany({
      where: { id: { in: groupIds }, sessionId: session.id },
      select: { id: true },
    });

    const existingSet = new Set(existingGroups.map((g: { id: string }) => g.id));
    const missing = groupIds.filter((id) => !existingSet.has(id));

    if (missing.length) {
      await prisma.whatsappGroup.createMany({
        data: missing.map((id) => ({ id, waId: id, name: id, sessionId: session.id })),
        skipDuplicates: true,
      });
    }

    const status =
      parsed.sendNow === "true" ? "queued" : scheduledAtParsed && scheduledAtParsed > new Date() ? "queued" : "draft";

    let imagePathFinal = imagePath;
    let linkUrlFinal = parsed.linkUrl;
    if (parsed.productId) {
      const product = await prisma.product.findFirst({
        where: { id: parsed.productId, userId },
        include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      });
      if (product) {
        if (!imagePathFinal && product.images[0]?.filePath) imagePathFinal = product.images[0].filePath;
        if (!linkUrlFinal && product.link) linkUrlFinal = product.link;
      }
    }

    const campaign = await prisma.campaign.create({
      data: {
        userId,
        sessionId: session.id,
        title: parsed.title,
        messageText: parsed.messageText,
        linkUrl: linkUrlFinal,
        imagePath: imagePathFinal,
        productId: parsed.productId || undefined,
        templateId: parsed.templateId || undefined,
        status,
        scheduledAt: scheduledAtParsed,
        repeatRule: parsed.repeatRule === "none" ? undefined : parsed.repeatRule,
        mentionAll: parsed.mentionAll === true,
        targets: {
          create: groupIds.map((gid) => ({ groupId: gid })),
        },
      },
      include: { targets: { include: { group: true } } },
    });

    if (parsed.sendNow === "true") {
      const { sendCampaign } = await import("../services/campaignSendService");
      await sendCampaign(campaign.id, userId);
    }

    res.status(201).json(campaign);
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Erro ao criar campanha" });
  }
});

router.post("/:id/send", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { sendCampaign } = await import("../services/campaignSendService");
    await sendCampaign(req.params.id, userId);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Erro ao enviar campanha" });
  }
});

router.patch("/:id/pause", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!campaign || campaign.userId !== userId) {
      return res.status(404).json({ message: "Campanha não encontrada" });
    }
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "paused" },
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Erro ao pausar" });
  }
});

router.patch("/:id/resume", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!campaign || campaign.userId !== userId) {
      return res.status(404).json({ message: "Campanha não encontrada" });
    }
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: campaign.scheduledAt && campaign.scheduledAt > new Date() ? "queued" : "draft" },
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Erro ao retomar" });
  }
});

router.delete("/all", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const campaigns = await prisma.campaign.findMany({ where: { userId }, select: { id: true } });
    const ids = campaigns.map((c: { id: string }) => c.id);
    if (ids.length === 0) {
      return res.json({ ok: true, deleted: 0 });
    }
    await prisma.$transaction([
      prisma.messageSend.updateMany({ where: { campaignId: { in: ids } }, data: { campaignId: null } }),
      prisma.campaignTarget.deleteMany({ where: { campaignId: { in: ids } } }),
      prisma.campaign.deleteMany({ where: { userId } }),
    ]);
    res.json({ ok: true, deleted: ids.length });
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Erro ao limpar" });
  }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!campaign) return res.status(404).json({ message: "Campanha não encontrada" });
    await prisma.$transaction([
      prisma.messageSend.updateMany({ where: { campaignId: campaign.id }, data: { campaignId: null } }),
      prisma.campaignTarget.deleteMany({ where: { campaignId: campaign.id } }),
      prisma.campaign.delete({ where: { id: campaign.id } }),
    ]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Erro ao excluir" });
  }
});

export default router;
