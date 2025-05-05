import { json } from "@remix-run/node";
import { getCodeVerifier } from "../db.server";

/**
 * Handle OAuth callback from Shopify Customer API
 */
export async function loader({ request }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    return json({ error: "Authorization code is missing" }, { status: 400 });
  }

  try {
    // Exchange code for access token, passing both code and state
    const tokenResponse = await exchangeCodeForToken(code, state);

    // Instead of redirecting, return HTML that auto-closes the tab
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Successful</title>
        <script>
          window.onload = function() {
            console.log('Authentication successful, storing in localStorage');

            // Store in localStorage as a backup method
            try {
              const tokenData = {
                access_token: '${tokenResponse.access_token}',
                expires_in: ${tokenResponse.expires_in},
                timestamp: Date.now()
              };
              localStorage.setItem('shopAiAuthData', JSON.stringify(tokenData));
              console.log('Stored auth data in localStorage');

              // Try to create an iframe to the parent domain to share the token
              const iframe = document.createElement('iframe');
              iframe.style.display = 'none';
              iframe.src = '/';
              iframe.onload = function() {
                try {
                  iframe.contentWindow.sessionStorage.setItem('shopAiCustomerAccessToken', '${tokenResponse.access_token}');
                  console.log('Set token via iframe');
                } catch(e) {
                  console.error('Could not set via iframe:', e);
                }
              };
              document.body.appendChild(iframe);
            } catch (e) {
              console.error('Failed to store in localStorage:', e);
            }

            // Use postMessage as well
            if (window.opener) {
              console.log('Window opener exists, sending postMessage');
              const message = {
                type: 'authentication_success',
                access_token: '${tokenResponse.access_token}',
                expires_in: ${tokenResponse.expires_in}
              };
              console.log('Message payload:', JSON.stringify(message));
              window.opener.postMessage(message, '*');
              console.log('Message sent to parent window');
            } else {
              console.log('No window.opener found - opened in same window?');
            }

            // Show success message briefly before closing
            document.getElementById('message').style.display = 'block';
            // Close the tab after a short delay
            setTimeout(function() {
              window.close();
              // In case window.close() doesn't work (common in some browsers)
              document.getElementById('fallback').style.display = 'block';
            }, 3500);
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
    return json({ error: "Failed to obtain access token" }, { status: 500 });
  }
}

/**
 * Exchange authorization code for access token
 * @param {string} code - The authorization code
 * @returns {Promise<Object>} - The token response
 */
async function exchangeCodeForToken(code, state) {
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const shopId = process.env.SHOPIFY_SHOP_ID;

  if (!clientId || !shopId) {
    throw new Error("SHOPIFY_CLIENT_ID and SHOPIFY_SHOP_ID environment variables are required");
  }

  const redirectUri = `${process.env.REDIRECT_URL || "https://largely-liked-killdeer.ngrok-free.app"}/auth/callback`;

  // Correct token URL format
  const tokenUrl = `https://shopify.com/authentication/${shopId}/oauth/token`;

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
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }

  return response.json();
}
