/**
 * Migration: Dashboard e agendamento - LinkClick, colunas scheduledAt e repeatRule em Campaign
 */
export const up = `
-- AlterTable Campaign
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "repeatRule" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);

-- CreateTable LinkClick
CREATE TABLE "LinkClick" (
    "id" TEXT NOT NULL,
    "messageSendId" TEXT NOT NULL,
    "linkUrl" TEXT NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LinkClick_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "LinkClick" ADD CONSTRAINT "LinkClick_messageSendId_fkey" FOREIGN KEY ("messageSendId") REFERENCES "MessageSend"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
`;

export const down = `
ALTER TABLE "LinkClick" DROP CONSTRAINT IF EXISTS "LinkClick_messageSendId_fkey";
DROP TABLE IF EXISTS "LinkClick";
ALTER TABLE "Campaign" DROP COLUMN IF EXISTS "repeatRule";
ALTER TABLE "Campaign" DROP COLUMN IF EXISTS "scheduledAt";
`;
