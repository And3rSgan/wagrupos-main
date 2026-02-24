import { Router } from "express";
import { z } from "zod";
import { authMiddleware, superAdminMiddleware } from "../middleware/auth";
import { prisma } from "../prismaClient";

const router = Router();
router.use(authMiddleware);
router.use(superAdminMiddleware);

/** Atribui/atualiza assinatura de uma empresa */
router.put("/company/:companyId", async (req, res) => {
  try {
    const schema = z.object({
      planId: z.string(),
    });
    const { planId } = schema.parse(req.body);

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return res.status(404).json({ message: "Plano não encontrado" });

    const company = await prisma.company.findUnique({
      where: { id: req.params.companyId },
      include: { subscription: true },
    });
    if (!company) return res.status(404).json({ message: "Empresa não encontrada" });

    const now = new Date();
    const billingDay = Math.min(28, Math.max(1, now.getDate()));
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), Math.min(billingDay, 28));
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    if (company.subscription) {
      await prisma.subscription.update({
        where: { id: company.subscription.id },
        data: {
          planId,
          status: "active",
          billingDay,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
    } else {
      await prisma.subscription.create({
        data: {
          companyId: company.id,
          planId,
          billingDay,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
    }

    const updated = await prisma.company.findUnique({
      where: { id: company.id },
      include: { subscription: { include: { plan: true } } },
    });
    res.json(updated?.subscription);
  } catch (err: any) {
    res.status(400).json({ message: err?.message ?? "Erro ao atualizar assinatura" });
  }
});

/** Altera o dia de vencimento (ciclo) da assinatura */
router.put("/company/:companyId/cycle", async (req, res) => {
  try {
    const schema = z.object({ billingDay: z.number().min(1).max(28) });
    const { billingDay } = schema.parse(req.body);

    const company = await prisma.company.findUnique({
      where: { id: req.params.companyId },
      include: { subscription: true },
    });
    if (!company) return res.status(404).json({ message: "Empresa não encontrada" });
    if (!company.subscription) return res.status(400).json({ message: "Empresa sem assinatura" });

    await prisma.subscription.update({
      where: { id: company.subscription.id },
      data: { billingDay },
    });
    const updated = await prisma.company.findUnique({
      where: { id: company.id },
      include: { subscription: { include: { plan: true } } },
    });
    res.json(updated?.subscription);
  } catch (err: any) {
    res.status(400).json({ message: err?.message ?? "Erro ao alterar ciclo" });
  }
});

/** Dar baixa manual: marca fatura pendente como paga e avança período */
router.post("/company/:companyId/baixa", async (req, res) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.companyId },
      include: { subscription: { include: { plan: true } }, invoices: true },
    });
    if (!company) return res.status(404).json({ message: "Empresa não encontrada" });
    if (!company.subscription) return res.status(400).json({ message: "Empresa sem assinatura" });

    const sub = company.subscription;
    const pendingInv = company.invoices.find((i) => ["pending", "overdue"].includes(i.status));
    const now = new Date();

    if (pendingInv) {
      await prisma.invoice.update({
        where: { id: pendingInv.id },
        data: { status: "paid", paidAt: now },
      });
    }

    const { billingDay } = sub;
    const nextEnd = new Date(sub.currentPeriodEnd);
    nextEnd.setMonth(nextEnd.getMonth() + 1);
    const d = Math.min(billingDay, 28);
    nextEnd.setDate(d);

    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        currentPeriodStart: sub.currentPeriodEnd,
        currentPeriodEnd: nextEnd,
      },
    });

    const nextDue = new Date(nextEnd);
    await prisma.invoice.create({
      data: {
        companyId: company.id,
        subscriptionId: sub.id,
        amount: sub.plan.price,
        status: "pending",
        dueDate: nextDue,
      },
    });

    const updated = await prisma.company.findUnique({
      where: { id: company.id },
      include: { subscription: { include: { plan: true } } },
    });
    res.json(updated?.subscription);
  } catch (err: any) {
    res.status(400).json({ message: err?.message ?? "Erro ao dar baixa" });
  }
});

export default router;
