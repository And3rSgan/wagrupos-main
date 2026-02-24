-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "billingDay" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Subscription" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
