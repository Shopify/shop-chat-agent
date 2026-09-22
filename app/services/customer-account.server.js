import { storeCustomerAccountUrls, getCustomerAccountUrls as getCustomerAccountUrlsFromDb } from "../db.server";
import { isShopifyUrl } from "./shop-origin.server";

/**
 * Get the customer account URLs for a shop, discovering and caching them per conversation
 * @param {string} shopOrigin - Origin of an installed shop, already validated
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Object|null>} The customer account URLs, or null when unavailable
 */
export async function getCustomerAccountUrls(shopOrigin, conversationId) {
  try {
    const existingUrls = await getCustomerAccountUrlsFromDb(conversationId);
    if (existingUrls) return existingUrls;

    const { hostname } = new URL(shopOrigin);

    const [mcpResponse, openidResponse] = await Promise.all([
      fetch(`https://${hostname}/.well-known/customer-account-api`).then(res => res.json()),
      fetch(`https://${hostname}/.well-known/openid-configuration`).then(res => res.json()),
    ]);

    const urls = {
      mcpApiUrl: mcpResponse.mcp_api,
      authorizationUrl: openidResponse.authorization_endpoint,
      tokenUrl: openidResponse.token_endpoint,
    };

    const untrusted = Object.values(urls).filter(url => url != null && !isShopifyUrl(url));
    if (untrusted.length > 0) {
      console.error("Discovery document returned non-Shopify URLs, ignoring:", untrusted);
      return null;
    }

    await storeCustomerAccountUrls({ conversationId, ...urls });

    return urls;
  } catch (error) {
    console.error("Error getting customer MCP API URL:", error);
    return null;
  }
}
