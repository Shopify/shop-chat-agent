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
  return { server, route };
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

routeTest("chat preflight allows the Shopify shop header", async () => {
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
