-- WhatsappSession: de userId para companyId (conexão por empresa)
-- 1. Adicionar companyId (idempotente se migration foi parcialmente aplicada)
ALTER TABLE "WhatsappSession" ADD COLUMN IF NOT EXISTS "companyId" TEXT;

-- 2. Preencher companyId a partir do usuário (apenas onde ainda está null)
UPDATE "WhatsappSession" s
SET "companyId" = u."companyId"
FROM "User" u
WHERE s."userId" = u.id AND u."companyId" IS NOT NULL AND s."companyId" IS NULL;

-- 3. Remover grupos e sessões cujo usuário não tem empresa (SuperAdmin)
-- Ordem: CampaignTarget -> MessageSend -> WhatsappGroup -> WhatsappSession
DELETE FROM "CampaignTarget" WHERE "groupId" IN (
  SELECT g.id FROM "WhatsappGroup" g
  JOIN "WhatsappSession" s ON g."sessionId" = s.id
  WHERE s."companyId" IS NULL
);
DELETE FROM "MessageSend" WHERE "groupId" IN (
  SELECT g.id FROM "WhatsappGroup" g
  JOIN "WhatsappSession" s ON g."sessionId" = s.id
  WHERE s."companyId" IS NULL
);
DELETE FROM "WhatsappGroup" WHERE "sessionId" IN (
  SELECT id FROM "WhatsappSession" WHERE "companyId" IS NULL
);
DELETE FROM "WhatsappSession" WHERE "companyId" IS NULL;

-- 4. Tornar companyId obrigatório
ALTER TABLE "WhatsappSession" ALTER COLUMN "companyId" SET NOT NULL;

-- 5. Remover coluna userId e FK
ALTER TABLE "WhatsappSession" DROP CONSTRAINT IF EXISTS "WhatsappSession_userId_fkey";
ALTER TABLE "WhatsappSession" DROP COLUMN "userId";

-- 6. Adicionar FK para Company
ALTER TABLE "WhatsappSession" ADD CONSTRAINT "WhatsappSession_companyId_fkey" 
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
