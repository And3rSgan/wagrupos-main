import { Router } from "express";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { authMiddleware, enrichAuth, AuthRequest } from "../middleware/auth";
import { prisma } from "../prismaClient";
import { campaignImageUpload, getFilePathForDb } from "../utils/multerCompanyUpload";
import { emitCampaignUpdated } from "../socketIo";

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
    include: {
      targets: { include: { group: true } },
      sends: {
        select: {
          id: true,
          groupId: true,
          status: true,
          error: true,
          group: { select: { name: true } },
        },
      },
      product: true,
    },
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
      repeatRule: z.enum(["none", "daily", "weekly", "weekdays"]).optional().default("none"),
      repeatWeekdays: z.union([z.string(), z.array(z.number().min(0).max(6))]).optional(),
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
        repeatWeekdays:
          parsed.repeatRule === "weekdays" && parsed.repeatWeekdays != null
            ? (() => {
                const arr = Array.isArray(parsed.repeatWeekdays)
                  ? parsed.repeatWeekdays
                  : (() => {
                      try {
                        return JSON.parse(parsed.repeatWeekdays as string) as number[];
                      } catch {
                        return [];
                      }
                    })();
                const valid = arr.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
                return valid.length > 0 ? JSON.stringify([...new Set(valid)].sort((a, b) => a - b)) : undefined;
              })()
            : undefined,
        mentionAll: parsed.mentionAll === true,
        targets: {
          create: groupIds.map((gid) => ({ groupId: gid })),
        },
      },
      include: { targets: { include: { group: true } } },
    });

    if (parsed.sendNow === "true") {
      const { addJobSafe, QUEUE_NAMES } = await import("../queue/bullmq");
      const { sendCampaign } = await import("../services/campaignSendService");
      const campaignId = campaign.id;
      addJobSafe(QUEUE_NAMES.CAMPAIGNS, "sendCampaign", { campaignId, userId }).then((result) => {
        if (!result.ok) {
          setImmediate(() => {
            sendCampaign(campaignId, userId).catch((err: any) =>
              require("../utils/logger").logger.error("CAMPAIGNS", "Envio em background falhou", err)
            );
          });
        }
      }).catch(() => {
        setImmediate(() => {
          sendCampaign(campaignId, userId).catch((err: any) =>
            require("../utils/logger").logger.error("CAMPAIGNS", "Envio em background falhou", err)
          );
        });
      });
    }
    if (companyId && status === "queued") emitCampaignUpdated(companyId);
    res.status(201).json(campaign);
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Erro ao criar campanha" });
  }
});

router.post("/:id/send", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, userId },
      select: { id: true, status: true },
    });
    if (!campaign) return res.status(404).json({ message: "Campanha não encontrada" });
    if (campaign.status === "queued") {
      return res.status(400).json({ message: "Campanha já está na fila de envio. Aguarde o processamento." });
    }
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "queued", errorMessage: null, scheduledAt: new Date() },
    });
    if (req.companyId) emitCampaignUpdated(req.companyId);
    const campaignId = campaign.id;
    const { addJobSafe, QUEUE_NAMES } = await import("../queue/bullmq");
    const { sendCampaign } = await import("../services/campaignSendService");
    addJobSafe(QUEUE_NAMES.CAMPAIGNS, "sendCampaign", { campaignId, userId }).then((result) => {
      if (!result.ok) {
        setImmediate(() => {
          sendCampaign(campaignId, userId).catch((err: any) =>
            require("../utils/logger").logger.error("CAMPAIGNS", "Envio em background falhou", err)
          );
        });
      }
    }).catch(() => {
      setImmediate(() => {
        sendCampaign(campaignId, userId).catch((err: any) =>
          require("../utils/logger").logger.error("CAMPAIGNS", "Envio em background falhou", err)
        );
      });
    });
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
    if (req.companyId) emitCampaignUpdated(req.companyId);
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
    if (req.companyId) emitCampaignUpdated(req.companyId);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Erro ao retomar" });
  }
});

/** Editar agendamento (data/hora, recorrência, dias da semana). Apenas para draft, queued ou paused. */
router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, userId },
      select: { id: true, status: true, scheduledAt: true, repeatRule: true, repeatWeekdays: true },
    });
    if (!campaign) return res.status(404).json({ message: "Campanha não encontrada" });
    if (!["draft", "queued", "paused"].includes(campaign.status)) {
      return res.status(400).json({ message: "Só é possível editar agendamento de campanhas em rascunho, na fila ou pausadas." });
    }
    const schema = z.object({
      scheduledAt: z.string().optional(),
      repeatRule: z.enum(["none", "daily", "weekly", "weekdays"]).optional(),
      repeatWeekdays: z.union([
        z.string(),
        z.array(z.number().min(0).max(6)),
      ]).optional(),
    });
    const parsed = schema.parse(req.body);
    const scheduledAtParsed = parsed.scheduledAt ? new Date(parsed.scheduledAt) : undefined;
    let repeatWeekdaysDb: string | null = null;
    let repeatWeekdaysArr: number[] = [];
    if (parsed.repeatRule === "weekdays" && parsed.repeatWeekdays != null) {
      const arr = Array.isArray(parsed.repeatWeekdays)
        ? parsed.repeatWeekdays
        : (() => {
            try {
              return JSON.parse(parsed.repeatWeekdays as string) as number[];
            } catch {
              return [];
            }
          })();
      const valid = arr.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
      repeatWeekdaysArr = [...new Set(valid)].sort((a, b) => a - b);
      if (repeatWeekdaysArr.length > 0) repeatWeekdaysDb = JSON.stringify(repeatWeekdaysArr);
    }
    const updateData: {
      scheduledAt?: Date;
      repeatRule?: string | null;
      repeatWeekdays?: string | null;
      status?: string;
    } = {};
    if (scheduledAtParsed !== undefined) updateData.scheduledAt = scheduledAtParsed;
    if (parsed.repeatRule !== undefined) {
      updateData.repeatRule = parsed.repeatRule === "none" ? null : parsed.repeatRule;
      updateData.repeatWeekdays = parsed.repeatRule === "weekdays" ? repeatWeekdaysDb : null;
    }

    if (parsed.repeatRule === "weekdays" && repeatWeekdaysArr.length > 0) {
      const baseDate = updateData.scheduledAt ?? (campaign.scheduledAt ? new Date(campaign.scheduledAt) : new Date());
      const baseHours = baseDate.getHours();
      const baseMinutes = baseDate.getMinutes();
      const baseSeconds = baseDate.getSeconds();
      const now = new Date();
      let next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), baseHours, baseMinutes, baseSeconds, 0);
      while (!repeatWeekdaysArr.includes(next.getDay())) {
        next.setDate(next.getDate() + 1);
      }
      if (next <= now) {
        next.setDate(next.getDate() + 1);
        while (!repeatWeekdaysArr.includes(next.getDay())) {
          next.setDate(next.getDate() + 1);
        }
        next.setHours(baseHours, baseMinutes, baseSeconds, 0);
      }
      updateData.scheduledAt = next;
    }

    if (updateData.scheduledAt && updateData.scheduledAt > new Date()) {
      updateData.status = "queued";
    }
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: updateData,
    });
    const updated = await prisma.campaign.findUnique({
      where: { id: campaign.id },
      include: { targets: { include: { group: true } }, product: true },
    });
    if (req.companyId) emitCampaignUpdated(req.companyId);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err?.message ?? "Erro ao atualizar agendamento" });
  }
});

/** Editar conteúdo da campanha (título, mensagem, mídia). Apenas draft, queued ou paused. */
router.put("/:id", campaignImageUpload.single("image"), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, userId },
      select: { id: true, status: true, imagePath: true },
    });
    if (!campaign) return res.status(404).json({ message: "Campanha não encontrada" });
    if (!["draft", "queued", "paused"].includes(campaign.status)) {
      return res.status(400).json({ message: "Só é possível editar conteúdo de campanhas em rascunho, na fila ou pausadas." });
    }
    const schema = z.object({
      messageText: z.string().min(1).optional(),
      title: z.string().optional(),
      removeImage: z
        .union([z.literal("true"), z.literal("false"), z.boolean()])
        .optional()
        .transform((v) => v === true || v === "true"),
    });
    const parsed = schema.parse(req.body);
    const updateData: { messageText?: string; title?: string; imagePath?: string | null } = {};
    if (parsed.messageText !== undefined) updateData.messageText = parsed.messageText;
    if (parsed.title !== undefined) updateData.title = parsed.title;

    let oldPathToDelete: string | null = null;
    if (req.file) {
      const newPath = getFilePathForDb(req, req.file.filename);
      updateData.imagePath = newPath;
      if (campaign.imagePath) {
        const p = campaign.imagePath.startsWith("uploads/") ? campaign.imagePath : campaign.imagePath.replace(/^\//, "");
        oldPathToDelete = path.resolve(process.cwd(), p);
      }
    } else if (parsed.removeImage === true) {
      updateData.imagePath = null;
      if (campaign.imagePath) {
        const p = campaign.imagePath.startsWith("uploads/") ? campaign.imagePath : campaign.imagePath.replace(/^\//, "");
        oldPathToDelete = path.resolve(process.cwd(), p);
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: updateData,
      });
    }

    if (oldPathToDelete && fs.existsSync(oldPathToDelete)) {
      try {
        fs.unlinkSync(oldPathToDelete);
      } catch (_) {
        // ignore
      }
    }

    const updated = await prisma.campaign.findUnique({
      where: { id: campaign.id },
      include: {
        targets: { include: { group: true } },
        product: true,
        sends: {
          select: {
            id: true,
            groupId: true,
            status: true,
            error: true,
            group: { select: { name: true } },
          },
        },
      },
    });
    if (req.companyId) emitCampaignUpdated(req.companyId);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err?.message ?? "Erro ao atualizar campanha" });
  }
});

router.patch("/:id/resend-failed", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, userId },
      select: { id: true },
    });
    if (!campaign) return res.status(404).json({ message: "Campanha não encontrada" });
    const failedCount = await prisma.messageSend.count({
      where: { campaignId: campaign.id, status: "failed" },
    });
    if (failedCount === 0) {
      return res.status(400).json({ message: "Nenhum grupo com falha para reenviar." });
    }
    const campaignId = campaign.id;
    const { addJobSafe, QUEUE_NAMES } = await import("../queue/bullmq");
    const { resendCampaignFailed } = await import("../services/campaignSendService");
    addJobSafe(QUEUE_NAMES.CAMPAIGNS, "resendCampaignFailed", { campaignId, userId }).then((result) => {
      if (!result.ok) {
        setImmediate(() => {
          resendCampaignFailed(campaignId, userId).catch((err: any) =>
            require("../utils/logger").logger.error("CAMPAIGNS", "Reenvio de falhas em background falhou", err)
          );
        });
      }
    }).catch(() => {
      setImmediate(() => {
        resendCampaignFailed(campaignId, userId).catch((err: any) =>
          require("../utils/logger").logger.error("CAMPAIGNS", "Reenvio de falhas em background falhou", err)
        );
      });
    });
    res.json({ ok: true, message: `Reenvio para ${failedCount} grupo(s) na fila.` });
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Erro ao reenviar" });
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
