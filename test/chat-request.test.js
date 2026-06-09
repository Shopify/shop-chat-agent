import { test } from "node:test";
import assert from "node:assert/strict";
import {
  jsonChatResponse,
  preflightChatResponse,
  resolveChatConversationId
} from "../app/services/chat-request.server.js";

test("pre-stream errors are JSON responses", async () => {
  process.env.NODE_ENV = "production";
  process.env.ALLOWED_ORIGINS = "https://shop.example.com";

  const request = new Request("https://example.com/chat", {
    headers: { Origin: "https://shop.example.com" }
  });
  const response = jsonChatResponse(request, { error: "Missing shop identifier" }, 400);

  assert.equal(response.status, 400);
  assert.equal(response.headers.get("Content-Type"), "application/json");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://shop.example.com");
  assert.equal(response.headers.get("Vary"), "Origin");
  assert.deepEqual(await response.json(), { error: "Missing shop identifier" });
});

test("preflight echoes requested chat headers", () => {
  process.env.NODE_ENV = "production";
  process.env.ALLOWED_ORIGINS = "https://shop.example.com";

  const request = new Request("https://example.com/chat", {
    method: "OPTIONS",
    headers: {
      Origin: "https://shop.example.com",
      "Access-Control-Request-Headers": "Content-Type, X-Shopify-Shop-Id"
    }
  });
  const response = preflightChatResponse(request);

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Headers"), "Content-Type, X-Shopify-Shop-Id");
});

test("rate-limit responses are JSON and include Retry-After", () => {
  process.env.NODE_ENV = "production";
  process.env.ALLOWED_ORIGINS = "https://shop.example.com";

  const request = new Request("https://example.com/chat", {
    headers: { Origin: "https://shop.example.com" }
  });
  const response = jsonChatResponse(request, { error: "Rate limit exceeded" }, 429, { "Retry-After": "60" });

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Content-Type"), "application/json");
  assert.equal(response.headers.get("Retry-After"), "60");
});

test("creates a new conversation ID when none is supplied", async () => {
  const result = await resolveChatConversationId({
    requestedConversationId: null,
    shopId: "123",
    findConversation: async () => assert.fail("should not load a missing conversation ID"),
    createId: () => "new-id"
  });

  assert.deepEqual(result, { conversationId: "new-id", notFound: false });
});

test("creates a new conversation ID for stale client state", async () => {
  const result = await resolveChatConversationId({
    requestedConversationId: "deleted-id",
    shopId: "123",
    findConversation: async () => null,
    createId: () => "new-id"
  });

  assert.deepEqual(result, { conversationId: "new-id", notFound: false });
});

test("rejects conversations owned by a different shop", async () => {
  const result = await resolveChatConversationId({
    requestedConversationId: "existing-id",
    shopId: "123",
    findConversation: async () => ({ shopId: "456" }),
    createId: () => assert.fail("should not mint over a wrong-shop conversation")
  });

  assert.deepEqual(result, { conversationId: null, notFound: true });
});

test("continues conversations owned by the requesting shop", async () => {
  const result = await resolveChatConversationId({
    requestedConversationId: "existing-id",
    shopId: "123",
    findConversation: async () => ({ shopId: "123" }),
    createId: () => assert.fail("should not replace a valid conversation")
  });

  assert.deepEqual(result, { conversationId: "existing-id", notFound: false });
});
