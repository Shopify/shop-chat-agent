-- CreateTable
CREATE TABLE "CustomerAccountEndpoints" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "mcpApi" TEXT,
    "authorizationEndpoint" TEXT,
    "tokenEndpoint" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccountEndpoints_conversationId_key" ON "CustomerAccountEndpoints"("conversationId");
