-- Add upgradePlanId to Invoice for upgrade flow (plan change on payment)
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "upgradePlanId" TEXT;
