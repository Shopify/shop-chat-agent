import { test } from "node:test";
import assert from "node:assert/strict";
import { conversationBelongsToShop } from "../app/services/conversation-access.server.js";

test("rejects missing conversation", () => {
  assert.equal(conversationBelongsToShop(null, "123"), false);
});

test("rejects missing shop header", () => {
  assert.equal(conversationBelongsToShop({ shopId: "123" }, null), false);
});

test("rejects legacy conversations with no shop", () => {
  assert.equal(conversationBelongsToShop({ shopId: null }, null), false);
  assert.equal(conversationBelongsToShop({ shopId: null }, "123"), false);
});

test("rejects wrong-shop conversations", () => {
  assert.equal(conversationBelongsToShop({ shopId: "123" }, "456"), false);
});

test("allows conversations owned by the requesting shop", () => {
  assert.equal(conversationBelongsToShop({ shopId: "123" }, "123"), true);
});
