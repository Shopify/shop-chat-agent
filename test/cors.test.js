import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin, corsOriginHeaders } from "../app/services/cors.server.js";

test("trusts origins listed in ALLOWED_ORIGINS", () => {
  process.env.NODE_ENV = "production";
  process.env.ALLOWED_ORIGINS = "https://shop.example.com, https://other.example.com";
  assert.equal(isAllowedOrigin("https://shop.example.com"), true);
  assert.equal(isAllowedOrigin("https://other.example.com"), true);
});

test("rejects unknown origins in production", () => {
  process.env.NODE_ENV = "production";
  process.env.ALLOWED_ORIGINS = "https://shop.example.com";
  assert.equal(isAllowedOrigin("https://evil.example.com"), false);
  assert.equal(isAllowedOrigin(null), false);
});

test("allows localhost only outside production", () => {
  process.env.ALLOWED_ORIGINS = "";
  process.env.NODE_ENV = "development";
  assert.equal(isAllowedOrigin("http://localhost:3000"), true);
  process.env.NODE_ENV = "production";
  assert.equal(isAllowedOrigin("http://localhost:3000"), false);
});

test("corsOriginHeaders is empty for untrusted origins", () => {
  process.env.NODE_ENV = "production";
  process.env.ALLOWED_ORIGINS = "https://shop.example.com";

  const trusted = new Request("https://api.example.com", { headers: { Origin: "https://shop.example.com" } });
  assert.equal(corsOriginHeaders(trusted)["Access-Control-Allow-Origin"], "https://shop.example.com");
  assert.equal(corsOriginHeaders(trusted).Vary, "Origin");

  const untrusted = new Request("https://api.example.com", { headers: { Origin: "https://evil.example.com" } });
  assert.deepEqual(corsOriginHeaders(untrusted), {});
});
