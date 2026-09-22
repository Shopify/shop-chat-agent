import { getCodeVerifier, storeCustomerToken, getCustomerAccountUrls, rotateConversation } from "../db.server";

/**
 * Handle OAuth callback from Shopify Customer API
 */
export async function loader({ request }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    return new Response(JSON.stringify({ error: "Authorization code is missing" }), { status: 400 });
  }

  const pending = state ? await getCodeVerifier(state) : null;
  if (!pending) {
    return new Response(JSON.stringify({ error: "Unknown or expired authorization state" }), { status: 400 });
  }

  try {
    const tokenResponse = await exchangeCodeForToken(code, pending);

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenResponse.expires_in);

    // Re-key the conversation so whoever started the flow with the old id cannot use this token
    const conversationId = await rotateConversation(pending.conversationId);
    await storeCustomerToken(conversationId, tokenResponse.access_token, expiresAt);

    return new Response(authCompletePage(conversationId, pending.shopOrigin), {
      headers: { "Content-Type": "text/html" }
    });
  } catch (error) {
    console.error("Error exchanging code for token:", error);
    return new Response(JSON.stringify({ error: "Failed to obtain access token" }), { status: 500 });
  }
}

/**
 * Exchange authorization code for access token
 * @param {string} code - The authorization code
 * @param {Object} pending - The consumed code verifier record for this flow
 * @returns {Promise<Object>} - The token response
 */
async function exchangeCodeForToken(code, pending) {
  const clientId = process.env.SHOPIFY_API_KEY;
  if (!clientId) {
    throw new Error("SHOPIFY_API_KEY environment variable is required");
  }

  const redirectUri = process.env.REDIRECT_URL;

  const tokenUrl = await getTokenUrl(pending.conversationId);

  if (!tokenUrl) {
    throw new Error("Token URL not found");
  }

  const formData = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: pending.verifier,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formData
  });

  if (!response.ok) {
    console.log("Request id", response.headers.get("x-request-id"));
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Get the token URL from the customer account URL
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<string|null>} - The token URL or null if not found
 */
async function getTokenUrl(conversationId) {
  const urls = await getCustomerAccountUrls(conversationId);
  return urls?.tokenUrl ?? null;
}

/**
 * Page shown in the auth popup. Hands the rotated conversation id to the storefront
 * that opened the popup and nothing else, then closes.
 */
function authCompletePage(conversationId, shopOrigin) {
  const payload = JSON.stringify({ type: "shop-ai-auth-complete", conversation_id: conversationId });

  return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Successful</title>
        <script>
          window.onload = function() {
            if (window.opener) {
              window.opener.postMessage(${payload}, ${JSON.stringify(shopOrigin)});
            }
            // Show success message briefly before closing
            document.getElementById('message').style.display = 'block';
            // Close the tab after a short delay
            setTimeout(function() {
              window.close();
              // In case window.close() doesn't work (common in some browsers)
              document.getElementById('fallback').style.display = 'block';
            }, 1500);
          }
        </script>
        <style>
          body { font-family: system-ui, sans-serif; text-align: center; padding-top: 100px; }
          #message { display: none; }
          #fallback { display: none; margin-top: 20px; }
          .success { color: green; font-size: 18px; }
        </style>
      </head>
      <body>
        <div id="message">
          <h2>Authentication Successful!</h2>
          <p class="success">You've been authenticated successfully</p>
          <p>This window will close automatically.</p>
        </div>
        <div id="fallback">
          <p>If this window didn't close automatically, you can close it and return to your conversation.</p>
        </div>
      </body>
      </html>
    `;
}
