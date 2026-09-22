import { vi } from "vitest";
import prisma from "../app/db.server";

export const SHOP = "test-shop.myshopify.com";
export const SHOP_ORIGIN = `https://${SHOP}`;
export const APP_URL = "https://app.example";

export async function installShop(shop = SHOP) {
  return prisma.session.create({
    data: { id: `offline_${shop}`, shop, state: "", accessToken: "shpat_test" },
  });
}

export function chatRequest({ origin = SHOP_ORIGIN, body, method = "POST", query = "" } = {}) {
  const headers = { "Content-Type": "application/json", Accept: "text/event-stream" };
  if (origin) headers.Origin = origin;

  return new Request(`${APP_URL}/chat${query}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export function stubFetch(handler) {
  const spy = vi.fn(async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    const response = await handler(url, init);
    return response ?? jsonResponse({}, 404);
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

export async function readSseEvents(response) {
  const text = await response.text();
  return text
    .split("\n\n")
    .filter(line => line.startsWith("data: "))
    .map(line => JSON.parse(line.slice(6)));
}
