import { generateAuthUrl } from "./auth.server";
import { getCustomerToken } from "./db.server";
import { createDelhiveryClient } from "./services/delhivery.server";

const UCP_AGENT_PROFILE = "https://shopify.dev/ucp/agent-profiles/examples/2026-08-25/valid-with-capabilities.json";

// Delhivery tool names are namespaced before being handed to Claude so they
// cannot collide with Shopify storefront, catalog or customer tool names.
const DELHIVERY_TOOL_PREFIX = "delhivery_";

// One client per process: it caches the OAuth token and the MCP session.
let delhiveryClient;

/**
 * Returns the shared Delhivery MCP client, creating it on first use.
 * @returns {Object|null} Client instance, or null when not configured
 */
function getDelhiveryClient() {
  if (delhiveryClient === undefined) {
    delhiveryClient = createDelhiveryClient();
  }

  return delhiveryClient;
}

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
    this.catalogTools = [];
    this.delhiveryTools = [];
    // TODO: Make this dynamic, for that first we need to allow access of mcp tools on password proteted demo stores.
    this.storefrontMcpEndpoint = `${hostUrl}/api/mcp`;
    this.catalogMcpEndpoint = `${hostUrl}/api/ucp/mcp`;

    const accountHostUrl = hostUrl.replace(/(\.myshopify\.com)$/, '.account$1');
    this.customerMcpEndpoint = customerMcpEndpoint || `${accountHostUrl}/customer/api/mcp`;
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
      const storefrontTools = this._formatToolsData(toolsData);

      this.storefrontTools = storefrontTools;
      this.tools = [...this.tools, ...storefrontTools];

      return storefrontTools;
    } catch (e) {
      console.error("Failed to connect to MCP server: ", e);
      throw e;
    }
  }

  /**
   * Connects to the UCP catalog MCP server and retrieves product tools.
   * Catalog tools are exposed separately from the standard storefront MCP server.
   *
   * @returns {Promise<Array>} Array of available catalog tools
   */
  async connectToCatalogServer() {
    try {
      console.log(`Connecting to catalog MCP server at ${this.catalogMcpEndpoint}`);

      const response = await this._makeJsonRpcRequest(
        this.catalogMcpEndpoint,
        "tools/list",
        {},
        { "Content-Type": "application/json" }
      );

      const toolsData = response.result && response.result.tools ? response.result.tools : [];
      const catalogTools = this._formatToolsData(toolsData);

      this.catalogTools = catalogTools;
      this.tools = [...this.tools, ...catalogTools];

      return catalogTools;
    } catch (error) {
      console.warn("Failed to connect to catalog MCP server:", error.message);
      return [];
    }
  }

  /**
   * Connects to the Delhivery One MCP server and retrieves shipment tracking tools.
   * Skipped silently when the Delhivery credentials are not configured.
   *
   * @returns {Promise<Array>} Array of available Delhivery tools
   */
  async connectToDelhiveryServer() {
    const client = getDelhiveryClient();

    if (!client) {
      console.log("Delhivery MCP not configured, skipping");
      return [];
    }

    try {
      console.log("Connecting to Delhivery One MCP server");

      const toolsData = await client.listTools();

      // Namespace the names so they cannot clash with Shopify tools.
      const delhiveryTools = this._formatToolsData(toolsData).map((tool) => ({
        ...tool,
        name: `${DELHIVERY_TOOL_PREFIX}${tool.name}`,
      }));

      this.delhiveryTools = delhiveryTools;
      this.tools = [...this.tools, ...delhiveryTools];

      return delhiveryTools;
    } catch (error) {
      console.warn("Failed to connect to Delhivery MCP server:", error.message);
      return [];
    }
  }

  /**
   * Calls a tool on the Delhivery One MCP server.
   *
   * @param {string} toolName - Namespaced name of the Delhivery tool
   * @param {Object} toolArgs - Arguments to pass to the tool
   * @returns {Promise<Object>} Result from the tool call, or an error envelope
   */
  async callDelhiveryTool(toolName, toolArgs) {
    const client = getDelhiveryClient();

    if (!client) {
      return {
        error: {
          type: "internal_error",
          data: "Delhivery tracking is not configured for this store.",
        },
      };
    }

    try {
      console.log("Calling Delhivery tool", toolName, toolArgs);

      // Strip the namespace before sending the name upstream.
      const remoteToolName = toolName.slice(DELHIVERY_TOOL_PREFIX.length);

      return await client.callTool(remoteToolName, toolArgs);
    } catch (error) {
      console.error(`Error calling Delhivery tool ${toolName}:`, error);
      return {
        error: {
          type: "internal_error",
          data: `Could not reach the Delhivery tracking dashboard: ${error.message}`,
        },
      };
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
    if (this.delhiveryTools.some(tool => tool.name === toolName)) {
      return this.callDelhiveryTool(toolName, toolArgs);
    } else if (this.customerTools.some(tool => tool.name === toolName)) {
      return this.callCustomerTool(toolName, toolArgs);
    } else if (this.catalogTools.some(tool => tool.name === toolName)) {
      return this.callCatalogTool(toolName, toolArgs);
    } else if (this.storefrontTools.some(tool => tool.name === toolName)) {
      return this.callStorefrontTool(toolName, toolArgs);
    } else {
      throw new Error(`Tool ${toolName} not found`);
    }
  }

  /**
   * Calls a tool on the UCP catalog MCP server.
   *
   * @param {string} toolName - Name of the catalog tool
   * @param {Object} toolArgs - Arguments to pass to the tool
   * @returns {Promise<Object>} Result from the tool call
   */
  async callCatalogTool(toolName, toolArgs) {
    try {
      console.log("Calling catalog tool", toolName, toolArgs);

      const catalogArguments = {
        ...toolArgs,
        meta: {
          ...toolArgs.meta,
          "ucp-agent": {
            ...toolArgs.meta?.["ucp-agent"],
            profile: UCP_AGENT_PROFILE
          }
        }
      };

      const response = await this._makeJsonRpcRequest(
        this.catalogMcpEndpoint,
        "tools/call",
        {
          name: toolName,
          arguments: catalogArguments,
        },
        { "Content-Type": "application/json" }
      );

      return response.result || response;
    } catch (error) {
      console.error(`Error calling catalog tool ${toolName}:`, error);
      throw error;
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
