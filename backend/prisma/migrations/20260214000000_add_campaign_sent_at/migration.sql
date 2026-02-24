-- Add sentAt to Campaign for daily limit tracking
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
