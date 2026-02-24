import { Router } from "express";
import { authMiddleware, AuthRequest, superAdminMiddleware } from "../middleware/auth";
import { prisma } from "../prismaClient";

const router = Router();
router.use(authMiddleware);
router.use(superAdminMiddleware);

/** Lista faturas de todas as empresas (SuperAdmin) */
router.get("/", async (req: AuthRequest, res) => {
  try {
    const { status, companyId } = req.query;
    const where: any = {};
    if (typeof status === "string" && status) {
      where.status = status;
    }
    if (typeof companyId === "string" && companyId) {
      where.companyId = companyId;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
      include: {
        company: { select: { id: true, name: true, slug: true, email: true } },
        subscription: { include: { plan: { select: { id: true, name: true, slug: true, price: true } } } },
      },
    });

    res.json(invoices);
  } catch (err: any) {
    res.status(400).json({ message: err?.message ?? "Erro ao listar faturas" });
  }
});

/** Baixa manual - marca fatura como paga (SuperAdmin) */
router.patch("/:id/mark-paid", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { subscription: true },
    });

    if (!invoice) {
      return res.status(404).json({ message: "Fatura não encontrada" });
    }

    if (invoice.status === "paid") {
      return res.status(400).json({ message: "Fatura já está paga" });
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id },
        data: {
          status: "paid",
          paidAt: now,
          mpPaymentId: `manual-${now.getTime()}`,
        },
      });

      if (invoice.subscription) {
        const sub = invoice.subscription;
        const baseDate = new Date(sub.currentPeriodEnd);
        const nextEnd = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, Math.min(sub.billingDay, 28));
        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            currentPeriodStart: sub.currentPeriodEnd,
            currentPeriodEnd: nextEnd,
            trialEndsAt: null,
          },
        });
      }
    });

    const updated = await prisma.invoice.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, slug: true } },
        subscription: { include: { plan: true } },
      },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err?.message ?? "Erro ao dar baixa" });
  }
});

export default router;
