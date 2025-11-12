-- CreateTable
CREATE TABLE "CustomerAccountUrls" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "mcpApiUrl" TEXT,
    "authorizationUrl" TEXT,
    "tokenUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccountUrls_conversationId_key" ON "CustomerAccountUrls"("conversationId");
