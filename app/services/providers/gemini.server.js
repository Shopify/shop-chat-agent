/**
 * Gemini Service
 * Manages interactions with the Google Gemini API
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import AppConfig from '../config.server';
import systemPrompts from '../../prompts/prompts.json';

/**
 * Creates a Gemini service instance
 * @param {string} apiKey - Gemini API key
 * @returns {Object} Gemini service with methods for interacting with Gemini API
 */
export function createGeminiService(apiKey = process.env.GEMINI_API_KEY) {
  // Initialize Gemini client
  const genAI = new GoogleGenerativeAI(apiKey);

  /**
   * Streams a conversation with Gemini
   * @param {Object} params - Stream parameters
   * @param {Array} params.messages - Conversation history
   * @param {string} params.promptType - The type of system prompt to use
   * @param {Array} params.tools - Available tools for Gemini
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
    const model = genAI.getGenerativeModel({
        model: AppConfig.api.providers.gemini.model,
        systemInstruction,
    });

    const chat = model.startChat({
        history: messages.slice(0, -1), // History should not include the latest message
        tools: tools && tools.length > 0 ? [{functionDeclarations: tools}] : undefined,
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessageStream(lastMessage.content);

    let fullResponseText = '';
    let functionCalls = [];

    for await (const chunk of result.stream) {
      if (chunk.candidates && chunk.candidates.length > 0) {
        const candidate = chunk.candidates[0];
        if(candidate.content && candidate.content.parts) {
            for(const part of candidate.content.parts) {
                if (part.text) {
                    if (streamHandlers.onText) {
                        streamHandlers.onText(part.text);
                    }
                    fullResponseText += part.text;
                }
                if (part.functionCall) {
                    // Gemini sends the whole function call in one chunk
                    if(streamHandlers.onToolUse) {
                        await streamHandlers.onToolUse({
                            id: part.functionCall.name, // Using name as ID for now
                            name: part.functionCall.name,
                            input: part.functionCall.args,
                        });
                    }
                }
            }
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
  createGeminiService
};
