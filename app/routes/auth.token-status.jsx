import { getConversation, getCustomerToken } from "../db.server";
import { conversationBelongsToShop } from "../services/conversation-access.server";
import { corsOriginHeaders } from "../services/cors.server";
import { rateLimitExceeded } from "../services/rate-limiter.server";

/**
 * API endpoint for checking if a customer token is available for a given conversation ID
 * The chat interface can poll this endpoint after displaying an auth link
 */
export async function loader({ request }) {
  if (rateLimitExceeded(request, "token-status", 60)) {
    return new Response(JSON.stringify({
      status: "error",
      message: "Rate limit exceeded"
    }), {
      status: 429,
      headers: { "Retry-After": "60", ...corsHeaders(request) }
    });
  }

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

  const shopId = request.headers.get("X-Shopify-Shop-Id");
  if (!shopId) {
    return new Response(JSON.stringify({
      status: "error",
      message: "Missing shop identifier"
    }), {
      status: 400,
      headers: corsHeaders(request)
    });
  }

  try {
    const conversation = await getConversation(conversationId);
    if (!conversationBelongsToShop(conversation, shopId)) {
      return new Response(JSON.stringify({
        status: "unauthorized"
      }), {
        status: 404,
        headers: corsHeaders(request)
      });
    }

    // Check if a token exists for this conversation ID
    const token = await getCustomerToken(conversationId, shopId);

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
  return {
    ...corsOriginHeaders(request),
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, X-Shopify-Shop-Id",
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
