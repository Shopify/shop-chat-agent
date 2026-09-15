import { createHash, randomBytes } from "node:crypto";

/**
 * Authentication service for handling OAuth and PKCE flows
 */

/**
 * Generate authorization URL for the customer
 * @param {string} conversationId - The conversation ID to track the auth flow
 * @returns {Promise<Object>} - Object containing the auth URL and conversation ID
 */
export async function generateAuthUrl(conversationId, shopId) {
  const { storeCodeVerifier } = await import('./db.server');

  // Generate authorization URL for the customer
  const clientId = process.env.SHOPIFY_API_KEY;
  const scope = "customer-account-mcp-api:full";
  const responseType = "code";

  // Use the actual app URL for redirect
  const redirectUri = "https://described-control-cosmetic-detroit.trycloudflare.com/callback";
  console.log("========== AUTH URL DEBUG ==========");
console.log("SHOPIFY_APP_URL:", process.env.SHOPIFY_APP_URL);
console.log("REDIRECT_URL:", process.env.REDIRECT_URL);
console.log("conversationId:", conversationId);
console.log("====================================");

  // Include the conversation ID and shop ID in the state parameter for tracking
  const state = `${conversationId}-${shopId}`;

  // Generate code verifier and challenge
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  // Store the code verifier in the database
  try {
    await storeCodeVerifier(state, verifier);
  } catch (error) {
    console.error('Failed to store code verifier:', error);
  }

  // Set code_challenge and code_challenge_method parameters
  const codeChallengeMethod = "S256";
  const baseAuthUrl = await getBaseAuthUrl(conversationId);

  if (!baseAuthUrl) {
    throw new Error('Base auth URL not found');
  }


  // Construct the authorization URL with hardcoded shop ID
  const authUrl = `${baseAuthUrl}?client_id=${clientId}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${responseType}&state=${state}&code_challenge=${challenge}&code_challenge_method=${codeChallengeMethod}`;

  return {
    url: authUrl,
    conversation_id: conversationId
  };
}

/**
 * Get the base auth URL from the customer MCP API URL
 * @param {string} conversationId - The conversation ID to track the auth flow
 * @returns {Promise<string|null>} - The base auth URL or null if not found
 */
async function getBaseAuthUrl(conversationId) {
  const { getCustomerAccountUrls } = await import('./db.server');
  const { authorizationUrl } = await getCustomerAccountUrls(conversationId);

  return authorizationUrl;
}

/**
 * Generate a code verifier for PKCE
 * @returns {string} - The generated code verifier
 */
export function generateCodeVerifier() {
  return randomBytes(32).toString("base64url");
}

/**
 * Generate a code challenge from a verifier
 * @param {string} verifier - The code verifier
 * @returns {Promise<string>} - The generated code challenge
 */
export async function generateCodeChallenge(verifier) {
  return createHash("sha256").update(verifier).digest("base64url");
}
