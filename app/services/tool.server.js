/**
 * Tool Service
 * Manages tool execution and processing
 */
import { saveMessage } from "../db.server";
import AppConfig from "./config.server";

/**
 * Creates a tool service instance
 * @returns {Object} Tool service with methods for managing tools
 */
export function createToolService() {
  /**
   * Handles a tool error response
   * @param {Object} toolUseResponse - The error response from the tool
   * @param {string} toolName - The name of the tool
   * @param {string} toolUseId - The ID of the tool use request
   * @param {Array} toolResults - Accumulator of tool_result blocks for this assistant turn
   * @param {Function} sendMessage - Function to send messages to the client
   */
  const handleToolError = (toolUseResponse, toolName, toolUseId, toolResults, sendMessage) => {
    if (toolUseResponse.error.type === "auth_required") {
      console.log("Auth required for tool:", toolName);
      toolResults.push(buildToolResult(toolUseId, toolUseResponse.error.data));
      sendMessage({ type: 'auth_required' });
    } else {
      console.log("Tool use error", toolUseResponse.error);
      toolResults.push(buildToolResult(toolUseId, toolUseResponse.error.data));
    }
  };

  /**
   * Handles a successful tool response
   * @param {Object} toolUseResponse - The response from the tool
   * @param {string} toolName - The name of the tool
   * @param {string} toolUseId - The ID of the tool use request
   * @param {Array} toolResults - Accumulator of tool_result blocks for this assistant turn
   * @param {Array} productsToDisplay - Array to add product results to
   * @param {Array} cartActionsToDisplay - Array to add real-cart write instructions to
   */
  const handleToolSuccess = (toolUseResponse, toolName, toolUseId, toolResults, productsToDisplay, cartActionsToDisplay = []) => {
    let contentForHistory = toolUseResponse.content;

    // Check if this is a product search result
    if (toolName === AppConfig.tools.productSearchName) {
      const allFormattedProducts = formatAllProductsFromResult(toolUseResponse);
      productsToDisplay.push(...allFormattedProducts.slice(0, AppConfig.tools.maxProductsToDisplay));

      // The raw UCP payload is ~17k chars for 5 products (duplicated description
      // HTML at product + variant + collection level) and would re-ride every
      // later turn. Store a compact list instead, then append the authoritative
      // price block so Claude never converts minor-unit amounts itself.
      const slimContent = [{
        type: 'text',
        text: JSON.stringify({
          count: allFormattedProducts.length,
          products: allFormattedProducts.map(slimProductForHistory)
        })
      }];

      // Reinforce prompt rule 6 at the point of failure: an empty search is a
      // silent dead-end in the transcripts otherwise.
      if (allFormattedProducts.length === 0) {
        slimContent.push({
          type: 'text',
          text: 'Знайдено 0 товарів за цим запитом. Повідом клієнта, що за таким запитом нічого не знайдено, і запропонуй уточнити параметри пошуку або звернутися до менеджера.'
        });
      }

      contentForHistory = appendPriceSummaryBlock(slimContent, allFormattedProducts);
    }

    // add_to_cart doesn't write to Shopify itself; it hands back a variant/quantity
    // pair the client must submit to the storefront's real AJAX Cart API.
    if (toolName === "add_to_cart" && toolUseResponse.cart_action) {
      cartActionsToDisplay.push(toolUseResponse.cart_action);
    }

    toolResults.push(buildToolResult(toolUseId, contentForHistory));
  };

  /**
   * Parses and formats every product from a search_catalog tool response,
   * with no slicing.
   * @param {Object} toolUseResponse - The response from the tool
   * @returns {Array} All formatted products (unsliced)
   */
  const formatAllProductsFromResult = (toolUseResponse) => {
    try {
      if (!toolUseResponse.content || toolUseResponse.content.length === 0) {
        return [];
      }

      const content = toolUseResponse.content[0].text;
      let responseData;
      if (typeof content === 'object') {
        responseData = content;
      } else if (typeof content === 'string') {
        responseData = JSON.parse(content);
      }

      if (responseData?.products && Array.isArray(responseData.products)) {
        return responseData.products.map(formatProductData);
      }
      return [];
    } catch (e) {
      console.error("Error parsing product data:", e);
      return [];
    }
  };

  /**
   * Processes product search results for card display (capped at maxProductsToDisplay)
   * @param {Object} toolUseResponse - The response from the tool
   * @returns {Array} Processed product data
   */
  const processProductSearchResult = (toolUseResponse) => {
    try {
      console.log("Processing product search result");
      const products = formatAllProductsFromResult(toolUseResponse)
        .slice(0, AppConfig.tools.maxProductsToDisplay);
      console.log(`Found ${products.length} products to display`);
      return products;
    } catch (error) {
      console.error("Error processing product search results:", error);
      return [];
    }
  };

  /**
   * Formats a money object ({ amount, currency }) into a deterministic
   * display string. Amounts are minor currency units (e.g. 248300 = 2483.00 UAH).
   * @param {{amount: number|string, currency: string}} money
   * @returns {string|null}
   */
  const formatMoney = (money) => {
    if (!money || !money.currency) return null;
    const amount = Number(money.amount);
    if (!Number.isFinite(amount)) return null;
    return `${(amount / 100).toFixed(2)} ${money.currency}`;
  };

  /**
   * Formats a product data object
   * @param {Object} product - Raw product data
   * @returns {Object} Formatted product data
   */
  const formatProductData = (product) => {
    const min = product.price_range?.min ?? product.variants?.[0]?.price;
    const max = product.price_range?.max;

    const minStr = formatMoney(min);
    let price = minStr || 'Ціна не вказана';
    if (minStr && max) {
      const maxStr = formatMoney(max);
      if (maxStr && maxStr !== minStr) {
        price = `від ${minStr}`;
      }
    }

    return {
      id: product.id || product.product_id || `product-${Math.random().toString(36).substring(7)}`,
      title: product.title || 'Product',
      price,
      image_url: product.media?.[0]?.url || '',
      description: (typeof product.description === 'string'
        ? product.description
        : product.description?.html) || '',
      url: product.url || '',
      variant_id: product.variants?.[0]?.id || null,
      available: product.available
        ?? product.variants?.[0]?.availability?.available
        ?? null
    };
  };

  /** Strips HTML tags and collapses whitespace. */
  const stripHtml = (html) =>
    String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  /**
   * Compact product shape stored in conversation history (see handleToolSuccess).
   * @param {Object} p - A formatProductData() object
   * @returns {Object}
   */
  const slimProductForHistory = (p) => ({
    id: p.id,
    title: p.title,
    price: p.price,
    url: p.url,
    available: p.available,
    variant_id: p.variant_id,
    description: stripHtml(p.description).slice(0, 400)
  });

  // Must stay byte-identical to the label referenced in
  // app/prompts/standard-assistant.txt response_rules.
  const PRICE_SUMMARY_LABEL = 'ФОРМАТОВАНІ ЦІНИ';

  /**
   * Builds an extra tool_result content block containing correctly-converted,
   * pre-formatted prices for every product in a search_catalog response.
   * Appended (not replacing) the raw tool content, so Claude is steered to
   * copy prices from here verbatim instead of computing them from raw JSON.
   * @param {Array} originalContent - toolUseResponse.content (raw MCP content blocks)
   * @param {Array} allFormattedProducts - full (unsliced) formatted product list
   * @returns {Array} content array to store in conversation history
   */
  const appendPriceSummaryBlock = (originalContent, allFormattedProducts) => {
    if (!allFormattedProducts.length) return originalContent;

    const lines = allFormattedProducts.map(
      (p) => `- ${p.title}: ${p.price} (id: ${p.id})`
    );

    const summaryText =
      `${PRICE_SUMMARY_LABEL} (авторитетне джерело цін для цієї відповіді):\n${lines.join('\n')}`;

    return [
      ...(Array.isArray(originalContent) ? originalContent : []),
      { type: 'text', text: summaryText }
    ];
  };

  /**
   * Builds a single tool_result content block.
   * @param {string} toolUseId - The ID of the tool use request
   * @param {*} content - The content of the tool result
   * @returns {Object} A tool_result block
   */
  const buildToolResult = (toolUseId, content) => ({
    type: "tool_result",
    tool_use_id: toolUseId,
    content: content
  });

  /**
   * Flushes every tool_result for one assistant turn as a SINGLE user message.
   * The Anthropic Messages API requires all tool_result blocks answering one
   * assistant turn to sit in one user message's content array; persisting them
   * as separate rows (one per parallel tool_use block) produces an invalid
   * user -> user shape that 400s the next request.
   * @param {Array} conversationHistory - The conversation history
   * @param {Array} toolResults - tool_result blocks accumulated during the turn
   * @param {string} conversationId - The conversation ID
   */
  const flushToolResults = async (conversationHistory, toolResults, conversationId) => {
    if (!toolResults || toolResults.length === 0) return;

    conversationHistory.push({ role: 'user', content: toolResults });

    if (conversationId) {
      try {
        await saveMessage(conversationId, 'user', JSON.stringify(toolResults));
      } catch (error) {
        console.error('Error saving tool results to database:', error);
      }
    }
  };

  return {
    handleToolError,
    handleToolSuccess,
    processProductSearchResult,
    flushToolResults
  };
}

export default {
  createToolService
};
