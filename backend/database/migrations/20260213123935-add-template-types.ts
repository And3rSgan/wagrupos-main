/**
 * Migration: Tipos de template - TemplateType para categorização de templates
 */
export const up = `
-- CreateTable TemplateType
CREATE TABLE "TemplateType" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TemplateType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TemplateType_userId_slug_key" ON "TemplateType"("userId", "slug");

ALTER TABLE "TemplateType" ADD CONSTRAINT "TemplateType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
`;

export const down = `
ALTER TABLE "TemplateType" DROP CONSTRAINT IF EXISTS "TemplateType_userId_fkey";
DROP TABLE IF EXISTS "TemplateType";
`;
