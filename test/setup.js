import { PrismaClient } from "@prisma/client";
import { beforeEach } from "vitest";
import { TEST_DB_URL } from "./db-path.js";

global.prismaGlobal = new PrismaClient({ datasourceUrl: TEST_DB_URL });

process.env.SHOPIFY_API_KEY ??= "test-api-key";
process.env.SHOPIFY_API_SECRET ??= "test-api-secret";
process.env.SHOPIFY_APP_URL ??= "https://app.example";
process.env.REDIRECT_URL ??= "https://app.example/auth/callback";
process.env.CLAUDE_API_KEY ??= "test-claude-key";

beforeEach(async () => {
  const db = global.prismaGlobal;
  await db.message.deleteMany();
  await db.conversation.deleteMany();
  await db.customerToken.deleteMany();
  await db.codeVerifier.deleteMany();
  await db.customerAccountUrls.deleteMany();
  await db.session.deleteMany();
});
