/**
 * Configuration Service
 * Centralizes all configuration values for the chat service
 */

export const AppConfig = {
  // API Configuration
  api: {
    defaultModel: 'claude-sonnet-5',
    maxTokens: 2000,
    defaultPromptType: 'standardAssistant',
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
    cartUpdateName: "update_cart",
    cartGetName: "get_cart",
    policiesSearchName: "search_shop_policies_and_faqs",
    recentOrderStatusName: "get_most_recent_order_status",
    orderStatusName: "get_order_status",
    maxProductsToDisplay: 3
  }
};

export default AppConfig;
