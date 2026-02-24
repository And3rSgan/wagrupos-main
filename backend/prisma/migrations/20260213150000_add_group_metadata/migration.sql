-- AlterTable
ALTER TABLE "WhatsappGroup" ADD COLUMN IF NOT EXISTS "participantCount" INTEGER;
ALTER TABLE "WhatsappGroup" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "WhatsappGroup" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'whatsapp';

-- CreateIndex (unique para evitar duplicatas na importação)
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsappGroup_sessionId_waId_key" ON "WhatsappGroup"("sessionId", "waId");
