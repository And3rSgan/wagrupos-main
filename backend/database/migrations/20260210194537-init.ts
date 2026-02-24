/**
 * Migration: Schema inicial - User, WhatsappSession, WhatsappGroup, Campaign, CampaignTarget, MessageSend
 */
export const up = `
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "waPushName" TEXT,
    "waPhone" TEXT,
    "waJid" TEXT,
    "waAvatarUrl" TEXT,
    "lastConnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsappSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappGroup" (
    "id" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsappGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "title" TEXT,
    "messageText" TEXT NOT NULL,
    "linkUrl" TEXT,
    "imagePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignTarget" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    CONSTRAINT "CampaignTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageSend" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT,
    "groupId" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "linkUrl" TEXT,
    "imagePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "CampaignTarget_campaignId_groupId_key" ON "CampaignTarget"("campaignId", "groupId");

-- AddForeignKey
ALTER TABLE "WhatsappSession" ADD CONSTRAINT "WhatsappSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhatsappGroup" ADD CONSTRAINT "WhatsappGroup_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WhatsappSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WhatsappSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignTarget" ADD CONSTRAINT "CampaignTarget_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignTarget" ADD CONSTRAINT "CampaignTarget_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "WhatsappGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MessageSend" ADD CONSTRAINT "MessageSend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MessageSend" ADD CONSTRAINT "MessageSend_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessageSend" ADD CONSTRAINT "MessageSend_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "WhatsappGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
`;

export const down = `
ALTER TABLE "MessageSend" DROP CONSTRAINT IF EXISTS "MessageSend_groupId_fkey";
ALTER TABLE "MessageSend" DROP CONSTRAINT IF EXISTS "MessageSend_campaignId_fkey";
ALTER TABLE "MessageSend" DROP CONSTRAINT IF EXISTS "MessageSend_userId_fkey";
ALTER TABLE "CampaignTarget" DROP CONSTRAINT IF EXISTS "CampaignTarget_groupId_fkey";
ALTER TABLE "CampaignTarget" DROP CONSTRAINT IF EXISTS "CampaignTarget_campaignId_fkey";
ALTER TABLE "Campaign" DROP CONSTRAINT IF EXISTS "Campaign_sessionId_fkey";
ALTER TABLE "Campaign" DROP CONSTRAINT IF EXISTS "Campaign_userId_fkey";
ALTER TABLE "WhatsappGroup" DROP CONSTRAINT IF EXISTS "WhatsappGroup_sessionId_fkey";
ALTER TABLE "WhatsappSession" DROP CONSTRAINT IF EXISTS "WhatsappSession_userId_fkey";
DROP TABLE "MessageSend";
DROP TABLE "CampaignTarget";
DROP TABLE "Campaign";
DROP TABLE "WhatsappGroup";
DROP TABLE "WhatsappSession";
DROP TABLE "User";
DROP TYPE "UserRole";
`;
