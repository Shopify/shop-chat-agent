import { generateAuthUrl } from "./auth.server";
import { getCustomerToken } from "./db.server";
import AppConfig from "./services/config.server";

/**
 * Client for interacting with Model Context Protocol (MCP) API endpoints.
 * Manages connections to both customer and storefront MCP endpoints, and handles tool invocation.
 */
class MCPClient {
  /**
   * Creates a new MCPClient instance.
   *
   * @param {string} hostUrl - The base URL for the shop
   * @param {string} conversationId - ID for the current conversation
   * @param {string} shopId - ID of the Shopify shop
   */
  constructor(hostUrl, conversationId, shopId, customerMcpEndpoint) {
    this.tools = [];
    this.customerTools = [];
    this.storefrontTools = [];
    this.ucpTools = [];
    // hostUrl is a normalized Origin ("https://shop.example") or null. When it's
    // null the endpoints can't be built and the connect methods skip themselves.
    // TODO: Make this dynamic, for that first we need to allow access of mcp tools on password proteted demo stores.
    this.storefrontMcpEndpoint = hostUrl ? `${hostUrl}/api/mcp` : null;
    // Shopify's catalog tools live here, not on /api/mcp. Every tools/call needs
    // an agent-profile URL in meta (see callUcpTool).
    this.ucpMcpEndpoint = hostUrl ? `${hostUrl}${AppConfig.ucp.mcpPath}` : null;

    const accountHostUrl = hostUrl ? hostUrl.replace(/(\.myshopify\.com)$/, '.account$1') : null;
    this.customerMcpEndpoint = customerMcpEndpoint
      || (accountHostUrl ? `${accountHostUrl}/customer/api/mcp` : null);
    this.customerAccessToken = "";
    this.conversationId = conversationId;
    this.shopId = shopId;
  }

  /**
   * Connects to the customer MCP server and retrieves available tools.
   * Attempts to use an existing token or will proceed without authentication.
   *
   * @returns {Promise<Array>} Array of available customer tools
   * @throws {Error} If connection to MCP server fails
   */
  async connectToCustomerServer() {
    if (!this.customerMcpEndpoint) {
      console.warn("No customer MCP endpoint; skipping customer tools");
      return [];
    }
    try {
      console.log(`Connecting to MCP server at ${this.customerMcpEndpoint}`);

      if (this.conversationId) {
        const dbToken = await getCustomerToken(this.conversationId);

        if (dbToken && dbToken.accessToken) {
          this.customerAccessToken = dbToken.accessToken;
        } else {
          console.log("No token in database for conversation:", this.conversationId);
        }
      }

      // If we still don't have a token, we'll connect without one
      // and tools that require auth will prompt for it later
      const headers = {
        "Content-Type": "application/json",
        "Authorization": this.customerAccessToken || ""
      };

      const response = await this._makeJsonRpcRequest(
        this.customerMcpEndpoint,
        "tools/list",
        {},
        headers
      );

      // Extract tools from the JSON-RPC response format
      const toolsData = response.result && response.result.tools ? response.result.tools : [];
      const customerTools = this._formatToolsData(toolsData);

      this.customerTools = customerTools;
      this.tools = [...this.tools, ...customerTools];

      return customerTools;
    } catch (e) {
      console.error("Failed to connect to MCP server: ", e);
      throw e;
    }
  }

  /**
   * Connects to the storefront MCP server and retrieves available tools.
   *
   * @returns {Promise<Array>} Array of available storefront tools
   * @throws {Error} If connection to MCP server fails
   */
  async connectToStorefrontServer() {
    if (!this.storefrontMcpEndpoint) {
      console.warn("No storefront MCP endpoint; skipping storefront tools");
      return [];
    }
    try {
      console.log(`Connecting to MCP server at ${this.storefrontMcpEndpoint}`);

      const headers = {
        "Content-Type": "application/json"
      };

      const response = await this._makeJsonRpcRequest(
        this.storefrontMcpEndpoint,
        "tools/list",
        {},
        headers
      );

      // Extract tools from the JSON-RPC response format
      const toolsData = response.result && response.result.tools ? response.result.tools : [];
      // update_cart/get_cart operate on a cart that's disconnected from the
      // shopper's real browser session cart (no cookies are forwarded to
      // this server-to-server MCP call). Advertising them lets Claude call
      // them intermittently and silently "add" items nowhere the shopper can
      // see. The real add-to-cart path is the local add_to_cart tool.
      const DISCONNECTED_CART_TOOLS = new Set(["update_cart", "get_cart"]);
      const storefrontTools = this._formatToolsData(toolsData)
        .filter((tool) => !DISCONNECTED_CART_TOOLS.has(tool.name));

      this.storefrontTools = storefrontTools;
      this.tools = [...this.tools, ...storefrontTools];

      return storefrontTools;
    } catch (e) {
      console.error("Failed to connect to MCP server: ", e);
      throw e;
    }
  }

  /**
   * Connects to the UCP MCP server (Shopify catalog) and retrieves the catalog
   * tools, filtered to the allow-list in AppConfig.ucp.tools so the cart /
   * checkout / order tools the endpoint also exposes never reach Claude.
   *
   * @returns {Promise<Array>} Array of available UCP catalog tools
   * @throws {Error} If connection to the UCP MCP server fails
   */
  async connectToUcpServer() {
    if (!this.ucpMcpEndpoint) {
      console.warn("No UCP MCP endpoint; skipping catalog tools");
      return [];
    }
    try {
      console.log(`Connecting to UCP MCP server at ${this.ucpMcpEndpoint}`);

      const headers = {
        "Content-Type": "application/json"
      };

      // tools/list does not need the agent profile; tools/call does.
      const response = await this._makeJsonRpcRequest(
        this.ucpMcpEndpoint,
        "tools/list",
        {},
        headers
      );

      const toolsData = response.result && response.result.tools ? response.result.tools : [];
      const allowed = new Set(AppConfig.ucp.tools);
      const ucpTools = this._formatToolsData(toolsData)
        .filter((tool) => allowed.has(tool.name));

      this.ucpTools = ucpTools;
      this.tools = [...this.tools, ...ucpTools];

      return ucpTools;
    } catch (e) {
      console.error("Failed to connect to UCP MCP server: ", e);
      throw e;
    }
  }

  /**
   * Dispatches a tool call to the appropriate MCP server based on the tool name.
   *
   * @param {string} toolName - Name of the tool to call
   * @param {Object} toolArgs - Arguments to pass to the tool
   * @returns {Promise<Object>} Result from the tool call
   * @throws {Error} If tool is not found or call fails
   */
  async callTool(toolName, toolArgs) {
    if (this.customerTools.some(tool => tool.name === toolName)) {
      return this.callCustomerTool(toolName, toolArgs);
    } else if (this.ucpTools.some(tool => tool.name === toolName)) {
      return this.callUcpTool(toolName, toolArgs);
    } else if (this.storefrontTools.some(tool => tool.name === toolName)) {
      return this.callStorefrontTool(toolName, toolArgs);
    } else {
      throw new Error(`Tool ${toolName} not found`);
    }
  }

  /**
   * Calls a tool on the storefront MCP server.
   *
   * @param {string} toolName - Name of the storefront tool to call
   * @param {Object} toolArgs - Arguments to pass to the tool
   * @returns {Promise<Object>} Result from the tool call
   * @throws {Error} If the tool call fails
   */
  async callStorefrontTool(toolName, toolArgs) {
    try {
      console.log("Calling storefront tool", toolName, toolArgs);

      const headers = {
        "Content-Type": "application/json"
      };

      const response = await this._makeJsonRpcRequest(
        this.storefrontMcpEndpoint,
        "tools/call",
        {
          name: toolName,
          arguments: toolArgs,
        },
        headers
      );

      return response.result || response;
    } catch (error) {
      console.error(`Error calling tool ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * Calls a catalog tool on the UCP MCP server. search_catalog, get_product and
   * lookup_catalog all take the same envelope: a meta["ucp-agent"].profile URL
   * that Shopify fetches for capability negotiation, plus a `catalog` object.
   *
   * A discovery / server error is turned into a normal tool_result the model can
   * act on (offer a manager hand-off) instead of throwing and killing the stream.
   *
   * @param {string} toolName - One of AppConfig.ucp.tools
   * @param {Object} toolArgs - Claude's args; `catalog` may already be nested
   * @returns {Promise<Object>} The tool result, or { error: { type, data } }
   */
  async callUcpTool(toolName, toolArgs) {
    // Build a fresh catalog object — never mutate Claude's tool input, which is
    // already stored verbatim as the assistant message.
    const incoming = toolArgs && toolArgs.catalog ? toolArgs.catalog : (toolArgs || {});
    const catalog = {
      ...incoming,
      context: {
        address_country: "UA",
        currency: "UAH",
        language: "uk",
        ...incoming.context,
      },
      pagination: {
        limit: 5,
        ...incoming.pagination,
      },
    };

    const catalogUnavailable = {
      error: {
        type: "catalog_unavailable",
        data: "Пошук по каталогу товарів тимчасово недоступний. Вибачся перед клієнтом і запропонуй звернутися до менеджера."
      }
    };

    const requestParams = {
      name: toolName,
      arguments: {
        meta: { "ucp-agent": { profile: AppConfig.ucp.agentProfileUrl } },
        catalog,
      },
    };

    // One retry: UCP discovery intermittently returns -32603 "Internal error".
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`Calling UCP tool ${toolName} (attempt ${attempt})`, JSON.stringify(catalog));

        const response = await this._makeJsonRpcRequest(
          this.ucpMcpEndpoint,
          "tools/call",
          requestParams,
          { "Content-Type": "application/json" }
        );

        if (response.error || (response.result && response.result.isError)) {
          console.error(`UCP tool ${toolName} failed:`, JSON.stringify(response.error || response.result));
          if (attempt === 1) continue;
          return catalogUnavailable;
        }

        return response.result || response;
      } catch (error) {
        console.error(`Error calling UCP tool ${toolName} (attempt ${attempt}):`, error);
        if (attempt === 2) return catalogUnavailable;
      }
    }

    return catalogUnavailable;
  }

  /**
   * Calls a tool on the customer MCP server.
   * Handles authentication if needed.
   *
   * @param {string} toolName - Name of the customer tool to call
   * @param {Object} toolArgs - Arguments to pass to the tool
   * @returns {Promise<Object>} Result from the tool call or auth error
   * @throws {Error} If the tool call fails
   */
  async callCustomerTool(toolName, toolArgs) {
    try {
      console.log("Calling customer tool", toolName, toolArgs);
      // First try to get a token from the database for this conversation
      let accessToken = this.customerAccessToken;

      if (!accessToken || accessToken === "") {
        const dbToken = await getCustomerToken(this.conversationId);

        if (dbToken && dbToken.accessToken) {
          accessToken = dbToken.accessToken;
          this.customerAccessToken = accessToken; // Store it for later use
        } else {
          console.log("No token in database for conversation:", this.conversationId);
        }
      }

      const headers = {
        "Content-Type": "application/json",
        "Authorization": accessToken
      };

      try {
        const response = await this._makeJsonRpcRequest(
          this.customerMcpEndpoint,
          "tools/call",
          {
            name: toolName,
            arguments: toolArgs,
          },
          headers
        );

        return response.result || response;
      } catch (error) {
        // Handle 401 specifically to trigger authentication
        if (error.status === 401) {
          console.log("Unauthorized, generating authorization URL for customer");

          // Generate auth URL
          const authResponse = await generateAuthUrl(this.conversationId, this.shopId);

          // Instead of retrying, return the auth URL for the front-end
          return {
            error: {
              type: "auth_required",
              data: `You need to authorize the app to access your customer data. [Click here to authorize](${authResponse.url})`
            }
          };
        }

        // Re-throw other errors
        throw error;
      }
    } catch (error) {
      console.error(`Error calling tool ${toolName}:`, error);
      return {
        error: {
          type: "internal_error",
          data: `Error calling tool ${toolName}: ${error.message}`
        }
      };
    }
  }

  /**
   * Makes a JSON-RPC request to the specified endpoint.
   *
   * @private
   * @param {string} endpoint - The endpoint URL
   * @param {string} method - The JSON-RPC method to call
   * @param {Object} params - Parameters for the method
   * @param {Object} headers - HTTP headers for the request
   * @returns {Promise<Object>} Parsed JSON response
   * @throws {Error} If the request fails
   */
  async _makeJsonRpcRequest(endpoint, method, params, headers) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: method,
        id: 1,
        params: params
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      const errorObj = new Error(`Request failed: ${response.status} ${error}`);
      errorObj.status = response.status;
      throw errorObj;
    }

    return await response.json();
  }

  /**
   * Formats raw tool data into a consistent format.
   *
   * @private
   * @param {Array} toolsData - Raw tools data from the API
   * @returns {Array} Formatted tools data
   */
  _formatToolsData(toolsData) {
    return toolsData.map((tool) => {
      return {
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema || tool.input_schema,
      };
    });
  }
}

export default MCPClient;
