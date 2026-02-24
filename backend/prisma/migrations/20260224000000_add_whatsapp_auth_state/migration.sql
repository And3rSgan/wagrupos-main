-- CreateTable
CREATE TABLE "WhatsappAuthState" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "WhatsappAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappAuthState_sessionId_key_key" ON "WhatsappAuthState"("sessionId", "key");

-- CreateIndex
CREATE INDEX "WhatsappAuthState_sessionId_idx" ON "WhatsappAuthState"("sessionId");
