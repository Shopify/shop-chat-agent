/**
 * Claude Service
 * Manages interactions with the Claude API
 */
import { Anthropic } from "@anthropic-ai/sdk";
import AppConfig from "./config.server";
import systemPrompts from "../prompts/prompts.json";

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
   * @param {Array} params.tools - Available tools for Claude
   * @param {string} params.userContext - The user context
   * @param {Object} streamHandlers - Stream event handlers
   * @param {Function} streamHandlers.onText - Handles text chunks
   * @param {Function} streamHandlers.onMessage - Handles complete messages
   * @param {Function} streamHandlers.onToolUse - Handles tool use requests
   * @returns {Promise<Object>} The final message
   */
  const streamConversation = async ({
    messages,
    promptType = AppConfig.api.defaultPromptType,
    tools,
    userContext
  }, streamHandlers) => {
    // Get system prompt from configuration or use default
    const systemInstruction = getSystemMessages(promptType, userContext);

    // Create stream
    const stream = await anthropic.messages.stream({
      model: AppConfig.api.defaultModel,
      max_tokens: AppConfig.api.maxTokens,
      system: systemInstruction,
      messages,
      tools: tools && tools.length > 0 ? tools : undefined
    });

    // Set up event handlers
    if (streamHandlers.onText) {
      stream.on('text', streamHandlers.onText);
    }

    if (streamHandlers.onMessage) {
      stream.on('message', streamHandlers.onMessage);
    }

    // Wait for final message
    const finalMessage = await stream.finalMessage();

    // Process tool use requests
    if (streamHandlers.onToolUse && finalMessage.content) {
      for (const content of finalMessage.content) {
        if (content.type === "tool_use") {
          await streamHandlers.onToolUse(content);
        }
      }
    }

    return finalMessage;
  };

  /**
   * Gets the system prompt content for a given prompt type
   * @param {string} promptType - The prompt type to retrieve
   * @param {Hash} userContext - The user context
   * @returns {Array} The system prompt content
   */
  const getSystemMessages = (promptType, userContext) => {
    const systemPromptContent = systemPrompts.systemPrompts[promptType]?.content ||
      systemPrompts.systemPrompts[AppConfig.api.defaultPromptType].content;

    return [
      {
        type: "text",
        text: systemPromptContent
      },
      {
        type: "text",
        text: `Make a json query via get_page_details tool to the following URL to gather information about the page that the user is currently visiting: ${userContext.currentPageUrl}. Please extract relevant details such as the title, description, and any other pertinent metadata. Ensure that you handle errors gracefully and provide fallback information if the JSON response is not available.`
      }
    ];
  };

  return {
    streamConversation,
    getSystemMessages
  };
}

export default {
  createClaudeService
};
