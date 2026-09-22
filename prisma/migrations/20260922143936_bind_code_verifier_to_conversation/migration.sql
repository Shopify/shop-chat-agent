-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CodeVerifier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "state" TEXT NOT NULL,
    "verifier" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "shopOrigin" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);
-- Pending OAuth flows are 10-minute ephemera and cannot be bound retroactively; they are dropped.
DROP TABLE "CodeVerifier";
ALTER TABLE "new_CodeVerifier" RENAME TO "CodeVerifier";
CREATE UNIQUE INDEX "CodeVerifier_state_key" ON "CodeVerifier"("state");
CREATE INDEX "CodeVerifier_state_idx" ON "CodeVerifier"("state");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
