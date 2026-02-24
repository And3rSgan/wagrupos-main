/**
 * Migration: Metadata dos grupos - participantCount, avatarUrl, source
 */
export const up = `
ALTER TABLE "WhatsappGroup" ADD COLUMN IF NOT EXISTS "participantCount" INTEGER;
ALTER TABLE "WhatsappGroup" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "WhatsappGroup" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'whatsapp';
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsappGroup_sessionId_waId_key" ON "WhatsappGroup"("sessionId", "waId");
`;

export const down = `
DROP INDEX IF EXISTS "WhatsappGroup_sessionId_waId_key";
ALTER TABLE "WhatsappGroup" DROP COLUMN IF EXISTS "source";
ALTER TABLE "WhatsappGroup" DROP COLUMN IF EXISTS "avatarUrl";
ALTER TABLE "WhatsappGroup" DROP COLUMN IF EXISTS "participantCount";
`;
