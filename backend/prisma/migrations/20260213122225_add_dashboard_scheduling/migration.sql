-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "repeatRule" TEXT,
ADD COLUMN     "scheduledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LinkClick" (
    "id" TEXT NOT NULL,
    "messageSendId" TEXT NOT NULL,
    "linkUrl" TEXT NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkClick_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LinkClick" ADD CONSTRAINT "LinkClick_messageSendId_fkey" FOREIGN KEY ("messageSendId") REFERENCES "MessageSend"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
