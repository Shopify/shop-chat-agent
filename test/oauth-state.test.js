import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeOAuthState, decodeOAuthState } from "../app/auth.server.js";

test("round-trips UUID conversation IDs", () => {
  const conversationId = "123e4567-e89b-12d3-a456-426614174000";
  const shopId = "987654321";

  const state = encodeOAuthState(conversationId, shopId);
  assert.deepEqual(decodeOAuthState(state), { conversationId, shopId });
});

test("keeps hyphenated conversation IDs intact", () => {
  const state = "123e4567-e89b-12d3-a456-426614174000:987654321";
  assert.deepEqual(decodeOAuthState(state), {
    conversationId: "123e4567-e89b-12d3-a456-426614174000",
    shopId: "987654321"
  });
});

test("rejects malformed state", () => {
  assert.deepEqual(decodeOAuthState(null), { conversationId: null, shopId: null });
  assert.deepEqual(decodeOAuthState("missing-separator"), { conversationId: null, shopId: null });
});
