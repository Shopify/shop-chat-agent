/**
 * LLM Service Factory
 * Dynamically creates an LLM service based on the application configuration.
 */
import { createClaudeService } from './providers/claude.server.js';
import { createOpenaiService } from './providers/openai.server.js';
import { createGeminiService } from './providers/gemini.server.js';
import { createGroqService } from './providers/groq.server.js';
import { createOpenrouterService } from './providers/openrouter.server.js';
import { getShopSettings } from './settings.server.js';
import AppConfig from './config.server.js';

/**
 * Creates an LLM service instance based on the configured provider for a specific shop.
 * @param {string} shop - The shop domain.
 * @returns {Promise<Object>} An LLM service instance.
 * @throws {Error} If the configured provider is not supported.
 */
export async function createLlmService(shop) {
  const settings = await getShopSettings(shop);

  const provider = settings?.llmProvider || process.env.LLM_PROVIDER || AppConfig.api.llmProvider;

  let apiKey;

  switch (provider) {
    case 'claude':
      apiKey = settings?.claudeApiKey || process.env.CLAUDE_API_KEY;
      return createClaudeService(apiKey);
    case 'openai':
      apiKey = settings?.openaiApiKey || process.env.OPENAI_API_KEY;
      return createOpenaiService(apiKey);
    case 'gemini':
      apiKey = settings?.geminiApiKey || process.env.GEMINI_API_KEY;
      return createGeminiService(apiKey);
    case 'groq':
      apiKey = settings?.groqApiKey || process.env.GROQ_API_KEY;
      return createGroqService(apiKey);
    case 'openrouter':
      apiKey = settings?.openrouterApiKey || process.env.OPENROUTER_API_KEY;
      return createOpenrouterService(apiKey);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

export default {
  createLlmService,
};
