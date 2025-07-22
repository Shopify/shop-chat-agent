/*
  Warnings:

  - Added the required column `merchantId` to the `Conversation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "merchantId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Conversation_merchantId_idx" ON "Conversation"("merchantId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
