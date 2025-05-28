/**
 * Claude Service
 * Manages interactions with the Claude API
 */
import { Anthropic } from "@anthropic-ai/sdk";
import AppConfig from "./config.server";
import systemPrompts from "../prompts/prompts.json";
import { generateAuthUrl } from "../auth.server";
/**
 * Creates a Claude service instance
 * @param {string} apiKey - Claude API key
 * @returns {Object} Claude service with methods for interacting with Claude API
 */
export function createClaudeService(apiKey = process.env.CLAUDE_API_KEY) {
  // Initialize Claude client
  const anthropic = new Anthropic({ apiKey });

  /**
   * Streams a conversation with Claude
   * @param {Object} params - Stream parameters
   * @param {Array} params.messages - Conversation history
   * @param {string} params.promptType - The type of system prompt to use
   * @param {string} params.customerMcpEndpoint - The customer MCP endpoint
   * @param {string} params.storefrontMcpEndpoint - The storefront MCP endpoint
   * @param {string} params.customerAccessToken - The customer access token
   * @param {string} params.shopId - The shop ID
   * @param {string} params.conversationId - The conversation ID
   * @param {Object} streamHandlers - Stream event handlers
   * @param {Function} streamHandlers.onText - Handles text chunks
   * @param {Function} streamHandlers.onMessage - Handles complete messages
   * @param {Function} streamHandlers.onToolUse - Handles tool use requests
   * @returns {Promise<Object>} The final message
   */
  const streamConversation = async ({
    messages,
    promptType = AppConfig.api.defaultPromptType,
    customerMcpEndpoint,
    storefrontMcpEndpoint,
    customerAccessToken,
    shopId,
    conversationId
  }, streamHandlers) => {
    // Get system prompt from configuration or use default
    const systemInstruction = getSystemPrompt(promptType);

    if (!customerAccessToken) {
      const authResponse = await generateAuthUrl(conversationId, shopId);
      const authRequiredMessage = {
        role: "assistant",
        content: `You need to authorize the app to access your customer data. [Click here to authorize](${authResponse.url})`,
        stop_reason: "auth_required"
      };
      streamHandlers.onText(authRequiredMessage.content);
      streamHandlers.onMessage(authRequiredMessage);
      return authRequiredMessage;
    }

    // Create stream
    const stream = await anthropic.beta.messages.stream(
      {
        model: AppConfig.api.defaultModel,
        max_tokens: AppConfig.api.maxTokens,
        system: systemInstruction,
        messages,
        mcp_servers: [
          {
            type: "url",
            name: "storefront-mcp-server",
            url: storefrontMcpEndpoint
          },
          {
            type: "url",
            name: "customer-mcp-server",
            url: customerMcpEndpoint,
            authorization_token: customerAccessToken
          }
        ],
      },
      {
        headers: {
          'anthropic-beta': 'mcp-client-2025-04-04',
        },
      },
    );

    // Set up event handlers
    if (streamHandlers.onText) {
      stream.on('text', streamHandlers.onText);
    }

    if (streamHandlers.onMessage) {
      stream.on('message', streamHandlers.onMessage);
    }

    if (streamHandlers.onContentBlock) {
      stream.on('contentBlock', streamHandlers.onContentBlock);
    }

    // Wait for final message
    const finalMessage = await stream.finalMessage();

    // Process tool use results
    if (streamHandlers.onToolResult && finalMessage.content) {
      for (const content of finalMessage.content) {
        if (content.type === "mcp_tool_result") {
          await streamHandlers.onToolResult(content);
        }
      }
    }

    return finalMessage;
  };

  /**
   * Gets the system prompt content for a given prompt type
   * @param {string} promptType - The prompt type to retrieve
   * @returns {string} The system prompt content
   */
  const getSystemPrompt = (promptType) => {
    return systemPrompts.systemPrompts[promptType]?.content ||
      systemPrompts.systemPrompts[AppConfig.api.defaultPromptType].content;
  };

  return {
    streamConversation,
    getSystemPrompt
  };
}

export default {
  createClaudeService
};
