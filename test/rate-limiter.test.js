import { test } from "node:test";
import assert from "node:assert/strict";
import { allowRequest, clientKey, rateLimitExceeded } from "../app/services/rate-limiter.server.js";

test("allows requests up to the limit, then blocks", () => {
  const key = `k-${Math.random()}`;
  assert.equal(allowRequest(key, 3), true);
  assert.equal(allowRequest(key, 3), true);
  assert.equal(allowRequest(key, 3), true);
  assert.equal(allowRequest(key, 3), false);
});

test("the window resets after it expires", async () => {
  const key = `k-${Math.random()}`;
  assert.equal(allowRequest(key, 1, 20), true);
  assert.equal(allowRequest(key, 1, 20), false);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(allowRequest(key, 1, 20), true);
});

test("endpoint prefixes isolate buckets", () => {
  const request = new Request("https://example.com", {
    headers: { "X-Forwarded-For": `1.2.3.${Math.floor(Math.random() * 255)}` }
  });

  assert.equal(rateLimitExceeded(request, "chat", 1), false);
  assert.equal(rateLimitExceeded(request, "chat", 1), true);
  assert.equal(rateLimitExceeded(request, "history", 1), false);
});

test("clientKey uses the rightmost forwarded IP", () => {
  const request = new Request("https://example.com", {
    headers: { "X-Forwarded-For": "1.2.3.4, 5.6.7.8", "X-Shopify-Shop-Id": "42" }
  });
  assert.equal(clientKey(request), "5.6.7.8");
});

test("clientKey does not include the client-supplied shop header", () => {
  const first = new Request("https://example.com", {
    headers: { "X-Forwarded-For": "1.2.3.4", "X-Shopify-Shop-Id": "42" }
  });
  const second = new Request("https://example.com", {
    headers: { "X-Forwarded-For": "1.2.3.4", "X-Shopify-Shop-Id": "99" }
  });

  assert.equal(clientKey(first), clientKey(second));
});

test("clientKey returns null when the forwarded IP is missing", () => {
  const request = new Request("https://example.com");
  assert.equal(clientKey(request), null);
});

test("rate limiting is skipped when no client key is available", () => {
  const request = new Request("https://example.com");
  assert.equal(rateLimitExceeded(request, "chat", 1), false);
  assert.equal(rateLimitExceeded(request, "chat", 1), false);
});
