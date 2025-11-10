import { chatService } from './config';
import { CustomerAccountUrls } from './domain/customer-account-urls';
import { Message } from './domain/message';
import { CustomerToken } from './domain/customer-token';

/**
 * Store a code verifier for PKCE authentication
 * @param {string} state - The state parameter used in OAuth flow
 * @param {string} verifier - The code verifier to store
 * @returns {Promise<Object>} - The saved code verifier object
 */
export async function storeCodeVerifier(state: string, verifier: string) {
  return await chatService.storeCodeVerifier(state, verifier);
}

/**
 * Get a code verifier by state parameter
 * @param {string} state - The state parameter used in OAuth flow
 * @returns {Promise<Object|null>} - The code verifier object or null if not found
 */
export async function getCodeVerifier(state: string) {
  return await chatService.getCodeVerifier(state);
}

/**
 * Store a customer access token in the database
 * @param {string} conversationId - The conversation ID to associate with the token
 * @param {string} accessToken - The access token to store
 * @param {Date} expiresAt - When the token expires
 * @returns {Promise<Object>} - The saved customer token
 */
export async function storeCustomerToken(
  conversationId: string,
  accessToken: string,
  expiresAt: string,
): Promise<CustomerToken> {
  return await chatService.storeCustomerToken(conversationId, accessToken, expiresAt);
}

/**
 * Get a customer access token by conversation ID
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Object|null>} - The customer token or null if not found/expired
 */
export async function getCustomerToken(conversationId: string): Promise<CustomerToken | null> {
  return await chatService.getCustomerToken(conversationId);
}

/**
 * Create or update a conversation in the database
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Object>} - The created or updated conversation
 */
export async function createOrUpdateConversation(conversationId: string, shopDomain: string): Promise<object> {
  return await chatService.createOrUpdateConversation(conversationId, shopDomain);
}

/**
 * Save a message to the database
 * @param {string} conversationId - The conversation ID
 * @param {string} role - The message role (user or assistant)
 * @param {string} content - The message content
 * @returns {Promise<Message>} - The saved message
 */
export async function saveMessage(
  conversationId: string,
  role: string,
  content: string,
  shopDomain: string
): Promise<Message> {
  if (shopDomain) {
    createOrUpdateConversation(conversationId, shopDomain);
  }

  return await chatService.saveMessage(conversationId, role, content);
}

/**
 * Get conversation history
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Message>} - Array of messages in the conversation
 */
export async function getConversationHistory(conversationId: string): Promise<Message[]> {
  return await chatService.getConversationHistory(conversationId);
}

/**
 * Store customer account URLs for a conversation
 * @param {string} conversationId - The conversation ID
 * @param {string} mcpApiUrl - The customer account MCP URL
 * @param {string} authorizationUrl - The customer account authorization URL
 * @param {string} tokenUrl - The customer account token URL
 * @returns {Promise<Object>} - The saved urls object
 */
export async function storeCustomerAccountUrls({
  conversationId,
  mcpApiUrl,
  authorizationUrl,
  tokenUrl,
}): Promise<object> {
  return chatService.storeCustomerAccountUrls({conversationId, mcpApiUrl, authorizationUrl, tokenUrl});
}

/**
 * Get customer account URLs for a conversation
 * @param {string} conversationId - The conversation ID
 * @returns {CustomerAccountUrls|null} - The customer account URLs or null if not found
 */
export async function getCustomerAccountUrls(conversationId: string): Promise<CustomerAccountUrls|null> {
  return await chatService.getCustomerAccountUrls(conversationId);
}
