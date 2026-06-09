/**
 * Conversation access checks.
 *
 * The shop ID header comes from the storefront client, so it is defense-in-depth
 * rather than a cryptographic proof of shop identity. The primary protection is
 * that server-created conversation IDs are unguessable.
 */

/**
 * @param {Object|null} conversation - Conversation record from the database
 * @param {string|null} shopId - Shop ID from the request
 * @returns {boolean} - Whether this request can use the conversation
 */
export function conversationBelongsToShop(conversation, shopId) {
  return Boolean(shopId && conversation?.shopId && conversation.shopId === shopId);
}
