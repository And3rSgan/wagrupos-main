import { Router, Request, Response } from "express";
import axios from "axios";
import { prisma } from "../prismaClient";
import { logger } from "../utils/logger";
import { getSetting } from "../services/systemSettingService";
import { emitInvoicePaid } from "../socketIo";

const router = Router();

async function markInvoicePaidAndEmit(invoice: {
  id: string;
  companyId: string;
  status: string;
  subscription: { id: string; currentPeriodEnd: Date; billingDay: number } | null;
  upgradePlanId: string | null;
}, paymentId: string) {
  if (!["pending", "overdue"].includes(invoice.status)) return;

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: "paid",
      mpPaymentId: paymentId,
      paidAt: new Date(),
    },
  });

  if (invoice.subscription) {
    const sub = invoice.subscription;
    const updateData: {
      currentPeriodStart: Date;
      currentPeriodEnd: Date;
      trialEndsAt: null;
      planId?: string;
    } = {
      currentPeriodStart: sub.currentPeriodEnd,
      currentPeriodEnd: new Date(
        sub.currentPeriodEnd.getFullYear(),
        sub.currentPeriodEnd.getMonth() + 1,
        Math.min(sub.billingDay, 28)
      ),
      trialEndsAt: null,
    };
    if (invoice.upgradePlanId) {
      updateData.planId = invoice.upgradePlanId;
    }
    await prisma.subscription.update({
      where: { id: sub.id },
      data: updateData,
    });
  }

  logger.success("WEBHOOK", `Fatura ${invoice.id} marcada como paga`);
  emitInvoicePaid(invoice.companyId, { invoiceId: invoice.id });
}

/** Webhook Mercado Pago - notificações de pagamento (payment) e pedido (order - Orders API) */
router.post("/mercadopago", async (req: Request, res: Response) => {
  try {
    const body = req.body as { type?: string; data?: { id?: string } };
    const type = body?.type;
    const dataId = body?.data?.id;
    if (!type || !dataId) {
      res.status(400).json({ message: "Payload inválido" });
      return;
    }

    const token = await getSetting("mercadopago_access_token");
    if (!token) {
      logger.warn("WEBHOOK", "MERCADOPAGO_ACCESS_TOKEN não configurado");
      res.status(200).send("OK");
      return;
    }

    const authHeader = { Authorization: `Bearer ${token}` };

    if (type === "payment") {
      const paymentRes = await axios.get(
        `https://api.mercadopago.com/v1/payments/${dataId}`,
        { headers: authHeader }
      );
      const payment = paymentRes.data as { status?: string; external_reference?: string };
      const status = payment?.status;
      const externalRef = payment?.external_reference;

      let invoice = externalRef
        ? await prisma.invoice.findUnique({
            where: { id: externalRef },
            include: { subscription: true },
          })
        : await prisma.invoice.findFirst({
            where: { mpPaymentId: String(dataId) },
            include: { subscription: true },
          });

      if (status === "approved" && invoice) {
        await markInvoicePaidAndEmit(invoice, String(dataId));
      }
    } else if (type === "order") {
      // Orders API (PIX criado via /v1/orders) - notificação envia id do pedido
      try {
        const orderRes = await axios.get(
          `https://api.mercadopago.com/v1/orders/${dataId}`,
          { headers: authHeader }
        );
        const order = orderRes.data as {
          external_reference?: string;
          status?: string;
          payments?: Array< { id?: string; status?: string } >;
        };
        const externalRef = order?.external_reference;
        const orderStatus = order?.status;
        const payments = order?.payments ?? [];
        const approvedPayment = payments.find((p) => p.status === "approved" || p.status === "credited");

        if (!externalRef && !approvedPayment?.id) {
          res.status(200).send("OK");
          return;
        }

        let invoice = externalRef
          ? await prisma.invoice.findUnique({
              where: { id: externalRef },
              include: { subscription: true },
            })
          : await prisma.invoice.findFirst({
              where: { mpPaymentId: String(approvedPayment?.id ?? dataId) },
              include: { subscription: true },
            });

        const isPaid =
          orderStatus === "paid" || approvedPayment != null;

        if (isPaid && invoice) {
          await markInvoicePaidAndEmit(
            invoice,
            String(approvedPayment?.id ?? dataId)
          );
        }
      } catch (orderErr) {
        logger.warn("WEBHOOK", "Erro ao buscar order MP", orderErr);
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    logger.error("WEBHOOK", "Erro ao processar webhook MP", err);
    res.status(500).json({ message: "Erro interno" });
  }
});

export default router;
