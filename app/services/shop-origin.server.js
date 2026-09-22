import prisma from "../db.server";

const SHOPIFY_HOST = /^([a-z0-9-]+\.)*(myshopify\.com|shopify\.com)$/i;

/**
 * Resolves the request Origin to an installed shop, or null when the origin
 * is missing, malformed, or does not match any app installation.
 */
export async function resolveInstalledShopOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return null;

  let url;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;

  const session = await prisma.session.findFirst({ where: { shop: url.hostname } });
  return session ? url.origin : null;
}

export function isShopifyUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && SHOPIFY_HOST.test(url.hostname);
  } catch {
    return false;
  }
}
