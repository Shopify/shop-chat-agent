/**
 * LLM Service Factory
 * Dynamically creates an LLM service based on the application configuration.
 */
import { createClaudeService } from './providers/claude.server.js';
import { createOpenaiService } from './providers/openai.server.js';
import { createGeminiService } from './providers/gemini.server.js';
import { createGroqService } from './providers/groq.server.js';
import { createOpenrouterService } from './providers/openrouter.server.js';
import AppConfig from './config.server.js';

/**
 * Creates an LLM service instance based on the configured provider.
 * @returns {Object} An LLM service instance.
 * @throws {Error} If the configured provider is not supported.
 */
export function createLlmService() {
  const provider = process.env.LLM_PROVIDER || AppConfig.api.llmProvider;

  switch (provider) {
    case 'claude':
      return createClaudeService();
    case 'openai':
      return createOpenaiService();
    case 'gemini':
      return createGeminiService();
    case 'groq':
      return createGroqService();
    case 'openrouter':
      return createOpenrouterService();
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

export default {
  createLlmService,
};
