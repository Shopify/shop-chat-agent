import { getCodeVerifier, storeCustomerToken } from "../db.server";

/**
 * Handle OAuth callback from Shopify Customer API
 */
export async function loader({ request }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const [conversationId, shopId] = state.split("-");

  if (!code) {
    return new Response(JSON.stringify({ error: "Authorization code is missing" }), { status: 400 });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await exchangeCodeForToken(code, state);

    // Store token in database
    try {
      // Calculate expiration date based on expires_in (seconds)
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenResponse.expires_in);

      // Store in database with conversation ID
      await storeCustomerToken(
        conversationId,
        tokenResponse.access_token,
        expiresAt
      );

      console.log('Stored customer token in database for conversation:', conversationId);
    } catch (error) {
      console.error('Failed to store token in database:', error);
      // Continue anyway to not disrupt user flow
    }

    // Instead of redirecting, return HTML that auto-closes the tab
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Successful</title>
        <script>
          window.onload = function() {
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
    `, {
      headers: {
        "Content-Type": "text/html"
      }
    });
  } catch (error) {
    console.error("Error exchanging code for token:", error);
    console.log("shopId", shopId);
    return new Response(JSON.stringify({ error: "Failed to obtain access token" }), { status: 500 });
  }
}

/**
 * Exchange authorization code for access token
 * @param {string} code - The authorization code
 * @returns {Promise<Object>} - The token response
 */
async function exchangeCodeForToken(code, state) {
  const clientId = process.env.SHOPIFY_API_KEY;
  const [conversationId, shopId] = state.split("-");
  if (!clientId || !shopId) {
    throw new Error("SHOPIFY_CLIENT_ID and SHOPIFY_SHOP_ID environment variables are required");
  }

  const redirectUri = process.env.REDIRECT_URL;

  // Correct token URL format
  const tokenUrl = await getTokenUrl(shopId, conversationId);

  if (!tokenUrl) {
    throw new Error("Token URL not found");
  }

  // Get the code verifier that corresponds to this authorization request from database
  let codeVerifier = "";
  try {
    const verifierRecord = await getCodeVerifier(state);
    if (verifierRecord) {
      codeVerifier = verifierRecord.verifier;
    } else {
      console.warn("Code verifier not found for state:", state);
      // Proceed anyway, since we might be using an older flow without PKCE
    }
  } catch (error) {
    console.error("Error retrieving code verifier:", error);
    // Proceed anyway and attempt the token exchange
  }

  const requestBody = {
    grant_type: "authorization_code",
    client_id: clientId,
    code: code,
    redirect_uri: redirectUri
  };

  // Add code_verifier if we have it
  if (codeVerifier) {
    requestBody.code_verifier = codeVerifier;
  }

  // Format the request as x-www-form-urlencoded instead of JSON
  const formData = new URLSearchParams();
  for (const [key, value] of Object.entries(requestBody)) {
    formData.append(key, value);
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formData
  });

  if (!response.ok) {
    console.log("Request id", response.headers.get("x-request-id"));
    console.log("conversation_id", conversationId);
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Get the token URL from the customer account URL
 * @param {string} shopId - The shop ID
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<string|null>} - The token URL or null if not found
 */
async function getTokenUrl(shopId, conversationId) {
  const { getCustomerAccountUrl } = await import('../db.server');
  const customerAccountUrl = await getCustomerAccountUrl(conversationId);
  if (!customerAccountUrl) {
    console.error('Customer account URL not found for conversation:', conversationId);
    return null;
  }

  const endpoint = `${customerAccountUrl}/.well-known/oauth-authorization-server`;
  const response = await fetch(endpoint);

  if (!response.ok) {
    console.error('Failed to fetch base auth URL from:', endpoint, response.status);

    return null;
  }

  const data = await response.json();
  return data.token_endpoint;
}
