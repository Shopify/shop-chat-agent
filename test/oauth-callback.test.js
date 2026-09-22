import { afterEach, describe, expect, test, vi } from "vitest";
import prisma from "../app/db.server";
import { getCustomerToken, saveMessage, storeCustomerAccountUrls } from "../app/db.server";
import { generateAuthUrl } from "../app/auth.server";
import { loader } from "../app/routes/auth.callback";
import { APP_URL, SHOP_ORIGIN, jsonResponse, stubFetch } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

async function conversationAwaitingAuth(id) {
  await saveMessage(id, "user", "show my orders");
  await storeCustomerAccountUrls({
    conversationId: id,
    mcpApiUrl: "https://shopify.com/1/account/customer/api/mcp",
    authorizationUrl: "https://shopify.com/authentication/1/oauth/authorize",
    tokenUrl: "https://shopify.com/authentication/1/oauth/token",
  });
  const { url } = await generateAuthUrl(id, SHOP_ORIGIN);
  return new URL(url).searchParams.get("state");
}

function callback(state) {
  return loader({ request: new Request(`${APP_URL}/auth/callback?code=abc&state=${encodeURIComponent(state)}`) });
}

describe("oauth callback", () => {
  test("rejects a state the server did not issue", async () => {
    const fetchSpy = stubFetch(() => jsonResponse({}));

    const response = await callback("attacker-conv:123");

    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await prisma.customerToken.count()).toBe(0);
  });

  test("stores the token under a fresh conversation id so the initiating conversation never receives it", async () => {
    const attackerKnownId = "attacker-known";
    const state = await conversationAwaitingAuth(attackerKnownId);
    stubFetch(() => jsonResponse({ access_token: "victim-token", expires_in: 3600 }));

    const response = await callback(state);

    expect(response.status).toBe(200);
    expect(await getCustomerToken(attackerKnownId)).toBeNull();
    expect(await prisma.conversation.findUnique({ where: { id: attackerKnownId } })).toBeNull();

    const rotated = await prisma.customerToken.findFirstOrThrow();
    expect(rotated.conversationId).not.toBe(attackerKnownId);
    expect(rotated.accessToken).toBe("victim-token");
    expect(await prisma.message.count({ where: { conversationId: rotated.conversationId } })).toBe(1);
    expect(await response.text()).toContain(rotated.conversationId);
  });

  test("consumes state on first use", async () => {
    const state = await conversationAwaitingAuth("conv-once");
    stubFetch(() => jsonResponse({ access_token: "t", expires_in: 3600 }));
    await callback(state);

    const replay = await callback(state);

    expect(replay.status).toBe(400);
  });
});
