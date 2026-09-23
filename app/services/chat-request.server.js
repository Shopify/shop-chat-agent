/**
 * Shared helpers for the /chat HTTP contract.
 */
import { conversationBelongsToShop } from "./conversation-access.server.js";
import { corsOriginHeaders } from "./cors.server.js";

export function preflightChatResponse(request) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request)
  });
}

export function jsonChatResponse(request, body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(request),
      "Content-Type": "application/json",
      ...extraHeaders
    }
  });
}

export async function resolveChatConversationId({ requestedConversationId, shopId, findConversation, createId }) {
  if (!requestedConversationId) {
    return { conversationId: createId(), notFound: false };
  }

  const conversation = await findConversation(requestedConversationId);
  if (!conversation) {
    return { conversationId: createId(), notFound: false };
  }

  if (!conversationBelongsToShop(conversation, shopId)) {
    return { conversationId: null, notFound: true };
  }

  return { conversationId: requestedConversationId, notFound: false };
}

/**
 * Gets CORS headers for the response
 * @param {Request} request - The request object
 * @returns {Object} CORS headers object
 */
export function getCorsHeaders(request) {
  const requestHeaders = request.headers.get("Access-Control-Request-Headers") || "Content-Type, Accept";

  return {
    ...corsOriginHeaders(request),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": requestHeaders,
    "Access-Control-Max-Age": "86400" // 24 hours
  };
}

/**
 * Get SSE headers for the response
 * @param {Request} request - The request object
 * @returns {Object} SSE headers object
 */
export function getSseHeaders(request) {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    ...corsOriginHeaders(request),
    "Access-Control-Allow-Methods": "GET,OPTIONS,POST",
    "Access-Control-Allow-Headers": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  };
}
