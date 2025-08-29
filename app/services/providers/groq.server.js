/**
 * Groq Service
 * Manages interactions with the Groq API
 */
import Groq from 'groq-sdk';
import AppConfig from '../config.server';
import systemPrompts from '../../prompts/prompts.json';

/**
 * Creates a Groq service instance
 * @param {string} apiKey - Groq API key
 * @returns {Object} Groq service with methods for interacting with Groq API
 */
export function createGroqService(apiKey = process.env.GROQ_API_KEY) {
  // Initialize Groq client
  const groq = new Groq({ apiKey });

  /**
   * Streams a conversation with Groq
   * @param {Object} params - Stream parameters
   * @param {Array} params.messages - Conversation history
   * @param {string} params.promptType - The type of system prompt to use
   * @param {Array} params.tools - Available tools for Groq
   * @param {Object} streamHandlers - Stream event handlers
   * @param {Function} streamHandlers.onText - Handles text chunks
   * @param {Function} streamHandlers.onMessage - Handles complete messages
   * @param {Function} streamHandlers.onToolUse - Handles tool use requests
   * @returns {Promise<Object>} The final message
   */
  const streamConversation = async ({
    messages,
    promptType = AppConfig.api.defaultPromptType,
    tools
  }, streamHandlers) => {
    const systemInstruction = getSystemPrompt(promptType);

    const stream = await groq.chat.completions.create({
      model: AppConfig.api.providers.groq.model,
      max_tokens: AppConfig.api.maxTokens,
      messages: [{role: 'system', content: systemInstruction}, ...messages],
      tools: tools && tools.length > 0 ? tools.map(t => ({type: 'function', function: t})) : undefined,
      stream: true,
    });

    let fullResponseText = '';
    let toolCalls = {};

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        if (streamHandlers.onText) {
          streamHandlers.onText(delta.content);
        }
        fullResponseText += delta.content;
      }

      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          if (toolCall.index !== undefined) {
            if (!toolCalls[toolCall.index]) {
              toolCalls[toolCall.index] = { id: '', type: 'function', function: { name: '', arguments: '' } };
            }
            if (toolCall.id) {
              toolCalls[toolCall.index].id = toolCall.id;
            }
            if (toolCall.function?.name) {
              toolCalls[toolCall.index].function.name = toolCall.function.name;
            }
            if (toolCall.function?.arguments) {
              toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
            }
          }
        }
      }
    }

    if (Object.keys(toolCalls).length > 0) {
        for(const index in toolCalls) {
            const toolCall = toolCalls[index];
            if (streamHandlers.onToolUse) {
                await streamHandlers.onToolUse({
                    id: toolCall.id,
                    name: toolCall.function.name,
                    input: JSON.parse(toolCall.function.arguments),
                });
            }
        }
    }

    const finalMessage = { role: 'assistant', content: fullResponseText, stop_reason: 'end_turn' };
    if (streamHandlers.onMessage) {
      streamHandlers.onMessage(finalMessage);
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
  createGroqService
};
