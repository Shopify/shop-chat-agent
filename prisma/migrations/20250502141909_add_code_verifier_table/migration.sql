-- CreateTable
CREATE TABLE "CodeVerifier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "state" TEXT NOT NULL,
    "verifier" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CodeVerifier_state_key" ON "CodeVerifier"("state");

-- CreateIndex
CREATE INDEX "CodeVerifier_state_idx" ON "CodeVerifier"("state");
