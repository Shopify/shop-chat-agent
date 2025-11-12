import { getCustomerToken } from "../db.server";

/**
 * API endpoint for checking if a customer token is available for a given conversation ID
 * The chat interface can poll this endpoint after displaying an auth link
 */
export async function loader({ request }) {
  // Get conversation ID from query parameter
  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversation_id");

  if (!conversationId) {
    return new Response(JSON.stringify({
      status: "error",
      message: "Missing conversation_id parameter"
    }), {
      status: 400,
      headers: corsHeaders(request)
    });
  }

  try {
    // Check if a token exists for this conversation ID
    const token = await getCustomerToken(conversationId);

    if (token) {
      // Token exists and is valid
      return new Response(JSON.stringify({
        status: "authorized",
        expires_at: token.expiresAt.toISOString()
      }), {
        headers: corsHeaders(request)
      });
    } else {
      // No token found or token expired
      return new Response(JSON.stringify({
        status: "unauthorized"
      }), {
        headers: corsHeaders(request)
      });
    }
  } catch (error) {
    console.error("Error checking token status:", error);
    return new Response(JSON.stringify({
      status: "error",
      message: "Failed to check token status"
    }), {
      status: 500,
      headers: corsHeaders(request)
    });
  }
}

/**
 * Helper to add CORS headers to the response
 */
function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400"
  };
}

// Handle OPTIONS requests for CORS preflight
export const action = async ({ request }) => {
  if (request.method.toLowerCase() === "options") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request)
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
};
