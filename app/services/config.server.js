/**
 * Configuration Service
 * Centralizes all configuration values for the chat service
 */

export const AppConfig = {
  // API Configuration
  api: {
    llmProvider: 'claude', // Default LLM provider
    maxTokens: 2000,
    defaultPromptType: 'standardAssistant',
    providers: {
      claude: {
        model: 'claude-3-5-sonnet-latest',
      },
      openai: {
        model: 'gpt-4-turbo',
      },
      gemini: {
        model: 'gemini-1.5-flash-latest',
      },
      groq: {
        model: 'llama3-8b-8192',
      },
      openrouter: {
        model: 'anthropic/claude-3.5-sonnet',
      },
    },
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
    productSearchName: "search_shop_catalog",
    maxProductsToDisplay: 3
  }
};

export default AppConfig;
