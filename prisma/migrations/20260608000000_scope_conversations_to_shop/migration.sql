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

-- Rebuild Conversation so shopId cannot be null after legacy rows are deleted.
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Conversation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shopId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Conversation" ("id", "shopId", "createdAt", "updatedAt")
SELECT "id", "shopId", "createdAt", "updatedAt" FROM "Conversation";
DROP TABLE "Conversation";
ALTER TABLE "new_Conversation" RENAME TO "Conversation";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE INDEX "Conversation_shopId_idx" ON "Conversation"("shopId");
