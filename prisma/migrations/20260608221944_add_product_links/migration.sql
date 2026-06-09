-- CreateEnum
CREATE TYPE "ProductLinkType" AS ENUM ('CROSS_SELL', 'UP_SELL');

-- CreateTable
CREATE TABLE "ProductLink" (
    "id" TEXT NOT NULL,
    "type" "ProductLinkType" NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductLink_fromId_idx" ON "ProductLink"("fromId");

-- CreateIndex
CREATE INDEX "ProductLink_toId_idx" ON "ProductLink"("toId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductLink_type_fromId_toId_key" ON "ProductLink"("type", "fromId", "toId");

-- AddForeignKey
ALTER TABLE "ProductLink" ADD CONSTRAINT "ProductLink_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductLink" ADD CONSTRAINT "ProductLink_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
