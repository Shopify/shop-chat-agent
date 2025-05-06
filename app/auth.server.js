/**
 * Authentication service for handling OAuth and PKCE flows
 */

/**
 * Generate authorization URL for the customer
 * @param {string} conversationId - The conversation ID to track the auth flow
 * @returns {Promise<Object>} - Object containing the auth URL and conversation ID
 */
export async function generateAuthUrl(conversationId) {
  // Import from db.server.js
  const { storeCodeVerifier } = await import('./db.server');

  // Generate authorization URL for the customer
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const scope = "openid email customer-account-mcp-api:full";
  const responseType = "code";

  // Hardcoded shop ID
  const shopId = process.env.SHOPIFY_SHOP_ID;

  // Use the actual app URL for redirect
  const redirectUri = `${process.env.REDIRECT_URL}/auth/callback`;

  // Include the conversation ID in the state parameter for tracking
  const state = conversationId || Date.now().toString();

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

  // Construct the authorization URL with hardcoded shop ID
  const authUrl = `https://shopify.com/authentication/${shopId}/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${responseType}&state=${state}&code_challenge=${challenge}&code_challenge_method=${codeChallengeMethod}`;

  return {
    url: authUrl,
    conversation_id: state
  };
}

/**
 * Generate a code verifier for PKCE
 * @returns {string} - The generated code verifier
 */
export function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const randomString = convertBufferToString(array);
  return base64UrlEncode(randomString);
}

/**
 * Generate a code challenge from a verifier
 * @param {string} verifier - The code verifier
 * @returns {Promise<string>} - The generated code challenge
 */
export async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digestOp = await crypto.subtle.digest('SHA-256', data);
  const hash = convertBufferToString(digestOp);
  return base64UrlEncode(hash);
}

/**
 * Convert a buffer to a string
 * @param {ArrayBuffer} buffer - The buffer to convert
 * @returns {string} - The converted string
 */
function convertBufferToString(buffer) {
  const uintArray = new Uint8Array(buffer);
  const numberArray = Array.from(uintArray);
  return String.fromCharCode.apply(null, numberArray);
}

/**
 * Encode a string in base64url format
 * @param {string} str - The string to encode
 * @returns {string} - The encoded string
 */
function base64UrlEncode(str) {
  // Convert string to base64
  let base64 = btoa(str);

  // Make base64 URL-safe by replacing characters
  base64 = base64.replace(/\+/g, "-")
                 .replace(/\//g, "_")
                 .replace(/=+$/, ""); // Remove any trailing '=' padding

  return base64;
}
