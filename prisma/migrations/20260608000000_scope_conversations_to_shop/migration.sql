-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "shopId" TEXT;

-- Drop legacy timestamp-based conversations that cannot be safely scoped to a shop.
DELETE FROM "CustomerToken" WHERE "conversationId" IN (
  SELECT "id" FROM "Conversation" WHERE "shopId" IS NULL
);
DELETE FROM "CustomerAccountUrls" WHERE "conversationId" IN (
  SELECT "id" FROM "Conversation" WHERE "shopId" IS NULL
);
DELETE FROM "Message" WHERE "conversationId" IN (
  SELECT "id" FROM "Conversation" WHERE "shopId" IS NULL
);
DELETE FROM "Conversation" WHERE "shopId" IS NULL;

-- CreateIndex
CREATE INDEX "Conversation_shopId_idx" ON "Conversation"("shopId");
