import { afterEach, describe, expect, test } from "vitest";
import { vi } from "vitest";
import prisma from "../app/db.server";
import { action, loader } from "../app/routes/chat";
import { getCustomerAccountUrls } from "../app/services/customer-account.server";
import { SHOP_ORIGIN, chatRequest, installShop, jsonResponse, stubFetch } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

describe("origin allowlist", () => {
  test("rejects a chat request whose Origin is not an installed shop before any outbound fetch", async () => {
    await installShop();
    const fetchSpy = stubFetch(() => jsonResponse({}));

    const response = await action({
      request: chatRequest({ origin: "https://attacker.example", body: { message: "hi" } }),
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("does not reflect an unknown Origin on history reads", async () => {
    const response = await loader({
      request: chatRequest({ origin: "https://evil.example", method: "GET", query: "?history=true&conversation_id=x" }),
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("customer account discovery", () => {
  test("ignores discovery documents that point at non-Shopify hosts", async () => {
    stubFetch(url => {
      if (url.endsWith("/.well-known/customer-account-api")) return jsonResponse({ mcp_api: "http://127.0.0.1:8080/internal" });
      if (url.endsWith("/.well-known/openid-configuration")) {
        return jsonResponse({
          authorization_endpoint: "https://shopify.com/authentication/1/oauth/authorize",
          token_endpoint: "https://shopify.com/authentication/1/oauth/token",
        });
      }
    });

    const urls = await getCustomerAccountUrls(SHOP_ORIGIN, "conv-1");

    expect(urls).toBeNull();
    expect(await prisma.customerAccountUrls.findUnique({ where: { conversationId: "conv-1" } })).toBeNull();
  });
});
