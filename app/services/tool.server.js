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
   * @param {Array} conversationHistory - The conversation history
   * @param {Function} sendMessage - Function to send messages to the client
   * @param {string} conversationId - The conversation ID
   */
  const handleToolError = async (
    toolUseResponse,
    toolName,
    toolUseId,
    conversationHistory,
    sendMessage,
    conversationId
  ) => {
    if (toolUseResponse.error.type === "auth_required") {
      console.log("Auth required for tool:", toolName);
      await addToolResultToHistory(
        conversationHistory,
        toolUseId,
        toolUseResponse.error.data,
        conversationId
      );
      sendMessage({ type: "auth_required" });
    } else {
      console.log("Tool use error", toolUseResponse.error);
      await addToolResultToHistory(
        conversationHistory,
        toolUseId,
        toolUseResponse.error.data,
        conversationId
      );
    }
  };

  /**
   * Handles a successful tool response
   * @param {Object} toolUseResponse - The response from the tool
   * @param {string} toolName - The name of the tool
   * @param {string} toolUseId - The ID of the tool use request
   * @param {Array} conversationHistory - The conversation history
   * @param {Array} productsToDisplay - Array to add product results to
   * @param {string} conversationId - The conversation ID
   */
  const handleToolSuccess = async (
    toolUseResponse,
    toolName,
    toolUseId,
    conversationHistory,
    productsToDisplay,
    responseEmbeddedUrls,
    conversationId
  ) => {
    // Check if this is a product search result
    if (toolName === AppConfig.tools.productSearchName) {
      console.log("product search result", toolUseResponse);
      productsToDisplay.push(...processProductSearchResult(toolUseResponse));
    }

    const responseData = processToolResponseAsJson(toolUseResponse);
    if (
      toolName === AppConfig.tools.getProductDetailsName &&
      responseData?.product?.embedded_url
    ) {
      responseEmbeddedUrls.push(responseData.product.embedded_url);
    }

    addToolResultToHistory(
      conversationHistory,
      toolUseId,
      toolUseResponse.content,
      conversationId
    );
  };

  /**
   * Processes the tool response
   * @param {Object} toolUseResponse - The response from the tool
   * @returns {Object} The processed response
   */
  const processToolResponseAsJson = (toolUseResponse) => {
    try {
      if (toolUseResponse.content && toolUseResponse.content.length > 0) {
        const content = toolUseResponse.content[0].text;
        try {
          let responseData;
          if (typeof content === "object") {
            responseData = content;
          } else if (typeof content === "string") {
            responseData = JSON.parse(content);
          }
          return responseData;
        } catch (e) {
          console.info("tool response is not a valid json:", content);
        }
      }
    } catch (error) {
      console.error("Error processing tool response:", error);
    }
    return {};
  };

  /**
   * Processes product search results
   * @param {Object} toolUseResponse - The response from the tool
   * @returns {Array} Processed product data
   */
  const processProductSearchResult = (toolUseResponse) => {
    try {
      console.log("Processing product search result");
      let products = [];

      if (toolUseResponse.content && toolUseResponse.content.length > 0) {
        const content = toolUseResponse.content[0].text;

        try {
          let responseData;
          if (typeof content === "object") {
            responseData = content;
          } else if (typeof content === "string") {
            responseData = JSON.parse(content);
          }

          if (responseData?.products && Array.isArray(responseData.products)) {
            products = responseData.products
              .slice(0, AppConfig.tools.maxProductsToDisplay)
              .map(formatProductData);

            console.log(`Found ${products.length} products to display`);
          }
        } catch (e) {
          console.error("Error parsing product data:", e);
        }
      }

      return products;
    } catch (error) {
      console.error("Error processing product search results:", error);
      return [];
    }
  };

  /**
   * Formats a product data object
   * @param {Object} product - Raw product data
   * @returns {Object} Formatted product data
   */
  const formatProductData = (product) => {
    const price = product.price_range
      ? `${product.price_range.currency} ${product.price_range.min}`
      : product.variants && product.variants.length > 0
        ? `${product.variants[0].currency} ${product.variants[0].price}`
        : "Price not available";

    return {
      id:
        product.product_id ||
        `product-${Math.random().toString(36).substring(7)}`,
      title: product.title || "Product",
      price: price,
      image_url: product.image_url || "",
      description: product.description || "",
      url: product.url || "",
      embedded_url: product.embedded_url || "",
    };
  };

  /**
   * Adds a tool result to the conversation history
   * @param {Array} conversationHistory - The conversation history
   * @param {string} toolUseId - The ID of the tool use request
   * @param {string} content - The content of the tool result
   * @param {string} conversationId - The conversation ID
   */
  const addToolResultToHistory = async (
    conversationHistory,
    toolUseId,
    content,
    conversationId
  ) => {
    const toolResultMessage = {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUseId,
          content: content,
        },
      ],
    };

    // Add to in-memory history
    conversationHistory.push(toolResultMessage);

    // Save to database with special format to indicate tool result
    if (conversationId) {
      try {
        await saveMessage(
          conversationId,
          "user",
          JSON.stringify(toolResultMessage.content)
        );
      } catch (error) {
        console.error("Error saving tool result to database:", error);
      }
    }
  };

  return {
    handleToolError,
    handleToolSuccess,
    processToolResponseAsJson,
    processProductSearchResult,
    addToolResultToHistory,
  };
}

export default {
  createToolService,
};
