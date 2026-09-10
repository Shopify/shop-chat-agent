/**
 * Configuration Service
 * Centralizes all configuration values for the chat service
 */

export const AppConfig = {
  // API Configuration
  api: {
    defaultModel: 'claude-sonnet-5',
    maxTokens: 8192,
    defaultPromptType: 'standardAssistant',
    // Hard cap on tool-use round trips per user message, so a stuck loop can't
    // re-invoke Claude forever.
    maxToolTurns: 8,
  },

  // UCP (Universal Commerce Protocol) catalog integration.
  // Shopify's catalog tools live on /api/ucp/mcp (not /api/mcp) and require an
  // agent-profile URL on every tools/call. The profile is served by this app at
  // `agentProfileUrl` and MUST come back as Content-Type: application/json.
  ucp: {
    mcpPath: "/api/ucp/mcp",
    // Public URL Shopify fetches during UCP discovery. Pinned to the Fly app's
    // public hostname because the container sets SHOPIFY_APP_URL to an internal
    // address (see Dockerfile); override with UCP_AGENT_PROFILE_URL elsewhere.
    agentProfileUrl: process.env.UCP_AGENT_PROFILE_URL
      || "https://shop-chat-agent-lively-fog-4926.fly.dev/.well-known/ucp-agent.json",
    version: "2026-08-25",
    // Declared in the hosted agent profile. Structured so cart/checkout/order
    // capabilities are a one-entry add later.
    services: {
      "dev.ucp.shopping": [{
        version: "2026-08-25",
        spec: "https://ucp.dev/2026-08-25/specification/overview",
        transport: "mcp",
        schema: "https://ucp.dev/2026-08-25/services/shopping/mcp.openrpc.json",
      }],
    },
    capabilities: {
      "dev.ucp.shopping.catalog.search": [{ version: "2026-08-25" }],
      "dev.ucp.shopping.catalog.lookup": [{ version: "2026-08-25" }],
    },
    // Allow-list: only these UCP tools are exposed to Claude; cart/checkout/order
    // tools the endpoint also lists are dropped. get_product / lookup_catalog
    // return a different response shape (`{product}` not `{products[]}`) that
    // handleToolSuccess doesn't parse — add them here only alongside handling.
    tools: ["search_catalog"],
  },

  // Error Message Templates
  errorMessages: {
    missingMessage: "Message is required",
    apiUnsupported: "This endpoint only supports server-sent events (SSE) requests or history requests.",
    authFailed: "Authentication failed with Claude API",
    apiKeyError: "Please check your API key in environment variables",
    rateLimitExceeded: "Rate limit exceeded",
    rateLimitDetails: "Please try again later",
    genericError: "Failed to get response from Claude"
  },

  // Tool Configuration
  tools: {
    productSearchName: "search_catalog",
    maxProductsToDisplay: 3
  }
};

export default AppConfig;
