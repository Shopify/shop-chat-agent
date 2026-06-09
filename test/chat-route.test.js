import { test } from "node:test";
import assert from "node:assert/strict";

let createServer;
try {
  ({ createServer } = await import("vite"));
} catch {
  createServer = null;
}

const routeTest = createServer ? test : test.skip;

async function loadChatRoute() {
  const server = await createServer({
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true }
  });

  const route = await server.ssrLoadModule("/app/routes/chat.jsx");
  const rateLimiter = await server.ssrLoadModule("/app/services/rate-limiter.server.js");

  return { server, route, rateLimiter };
}

routeTest("chat action rejects missing shop before streaming", async () => {
  const { server, route } = await loadChatRoute();
  try {
    const response = await route.action({
      request: new Request("https://example.com/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream"
        },
        body: JSON.stringify({ message: "hello" })
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.headers.get("Content-Type"), "application/json");
    assert.deepEqual(await response.json(), { error: "Missing shop identifier" });
  } finally {
    await server.close();
  }
});

routeTest("history loader rejects missing shop before reading history", async () => {
  const { server, route } = await loadChatRoute();
  try {
    const response = await route.loader({
      request: new Request("https://example.com/chat?history=true&conversation_id=abc")
    });

    assert.equal(response.status, 400);
    assert.equal(response.headers.get("Content-Type"), "application/json");
    assert.deepEqual(await response.json(), { error: "Missing shop identifier" });
  } finally {
    await server.close();
  }
});

routeTest("chat action returns a JSON 429 before streaming", async () => {
  const { server, route, rateLimiter } = await loadChatRoute();
  try {
    const ip = "203.0.113.68";
    for (let i = 0; i < 20; i++) {
      assert.equal(rateLimiter.allowRequest(`chat:${ip}`, 20), true);
    }

    const response = await route.action({
      request: new Request("https://example.com/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
          "X-Forwarded-For": ip,
          "X-Shopify-Shop-Id": "123"
        },
        body: JSON.stringify({ message: "hello" })
      })
    });

    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Content-Type"), "application/json");
    assert.equal(response.headers.get("Retry-After"), "60");
  } finally {
    await server.close();
  }
});

routeTest("history loader has an independent rate-limit bucket", async () => {
  const { server, route, rateLimiter } = await loadChatRoute();
  try {
    const ip = "203.0.113.69";
    for (let i = 0; i < 20; i++) {
      assert.equal(rateLimiter.allowRequest(`chat:${ip}`, 20), true);
    }

    const response = await route.loader({
      request: new Request("https://example.com/chat?history=true&conversation_id=abc", {
        headers: {
          "X-Forwarded-For": ip,
          "X-Shopify-Shop-Id": "123"
        }
      })
    });

    assert.notEqual(response.status, 429);
  } finally {
    await server.close();
  }
});

routeTest("chat preflight allows the Shopify shop header", async () => {
  process.env.NODE_ENV = "production";
  process.env.ALLOWED_ORIGINS = "https://shop.example.com";

  const { server, route } = await loadChatRoute();
  try {
    const response = await route.loader({
      request: new Request("https://example.com/chat", {
        method: "OPTIONS",
        headers: {
          Origin: "https://shop.example.com",
          "Access-Control-Request-Headers": "Content-Type, X-Shopify-Shop-Id"
        }
      })
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get("Access-Control-Allow-Headers"), "Content-Type, X-Shopify-Shop-Id");
  } finally {
    await server.close();
  }
});
