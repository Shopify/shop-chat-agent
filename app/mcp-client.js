import { generateAuthUrl } from "./auth.server";
import { getCustomerToken } from "./db.server";

class MCPClient {
  constructor(hostUrl, conversationId) {
    this.tools = [];
    this.customerTools = [];
    this.storefrontTools = [];
    // TODO: Make this dynamic, for that first we need to allow access of mcp tools on password proteted demo stores.
    this.storefrontMcpEndpoint = `${hostUrl}/api/mcp`;

    const accountHostUrl = hostUrl.replace(/(\.myshopify\.com)$/, '.account$1');
    this.customerMcpEndpoint = `${accountHostUrl}/customer/api/mcp`;
    this.customerAccessToken = "";
    this.conversationId = conversationId;
    const mcpUsername = "shopify_dev";
    const mcpPassword = "pcyWggWqxjvnkqub2CUqcWLqbAgsh8DRBaszawQKpxQzUj3CvsZa7reCgBucNZjswyAdg7oUMUW87MaPMmwb948zxCyRH3CWmeFE";
    const authString = `${mcpUsername}:${mcpPassword}`;
    const base64Auth = Buffer.from(authString).toString('base64');

    this.headers = {
      "Content-Type": "application/json",
      "Authorization": `Basic ${base64Auth}`
    };
  }

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

      // Make a direct request to get available tools
      const response = await fetch(`${this.customerMcpEndpoint}`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/list",
          id: 1,
          params: {}
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to list tools: ${response.status} ${error}`);
      }

      const result = await response.json();

      // Extract tools from the JSON-RPC response format
      const toolsData = result.result && result.result.tools ? result.result.tools : [];

      const customerTools = toolsData.map((tool) => {
        return {
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema || tool.input_schema,
        };
      });

      this.customerTools = customerTools;
      this.tools = [...this.tools, ...customerTools];

      return customerTools;
    } catch (e) {
        console.error("Failed to connect to MCP server: ", e);
        throw e;
    }
  }

  async connectToStorefrontServer() {
    try {
        console.log(`Connecting to MCP server at ${this.storefrontMcpEndpoint}`);

        // Make a direct request to get available tools
        const response = await fetch(`${this.storefrontMcpEndpoint}`, {
          method: "POST",
          headers: this.headers,
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "tools/list",
            id: 1,
            params: {}
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to list tools: ${response.status} ${error}`);
        }

        const result = await response.json();

        // Extract tools from the JSON-RPC response format
        const toolsData = result.result && result.result.tools ? result.result.tools : [];
        const storefrontTools = toolsData.map((tool) => {
          return {
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema || tool.input_schema,
          };
        });

        this.storefrontTools = storefrontTools;
        this.tools = [...this.tools, ...storefrontTools];

        return storefrontTools;
    } catch (e) {
        console.error("Failed to connect to MCP server: ", e);
        throw e;
    }
  }

  async callTool(toolName, toolArgs) {
    if (this.customerTools.some(tool => tool.name === toolName)) {
      return this.callCustomerTool(toolName, toolArgs);
    } else if (this.storefrontTools.some(tool => tool.name === toolName)) {
      return this.callStorefrontTool(toolName, toolArgs);
    } else {
      throw new Error(`Tool ${toolName} not found`);
    }
  }

  async callStorefrontTool(toolName, toolArgs) {
    try {
      const response = await fetch(`${this.storefrontMcpEndpoint}`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          id: 1,
          params: {
            name: toolName,
            arguments: toolArgs,
          }
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Tool call failed: ${response.status} ${error}`);
      }

      const result = await response.json();
      return result.result || result;
    } catch (error) {
      console.error(`Error calling tool ${toolName}:`, error);
      throw error;
    }
  }

  async callCustomerTool(toolName, toolArgs) {
    try {
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

      const response = await fetch(`${this.customerMcpEndpoint}`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          id: 1,
          params: {
            name: toolName,
            arguments: toolArgs,
          }
        }),
      });

      if (response.status === 401) {
        console.log("Unauthorized, generating authorization URL for customer");

        // Generate auth URL
        const authResponse = await generateAuthUrl(this.conversationId);

        // Instead of retrying, return the auth URL for the front-end
        return {
          error: {
            type: "auth_required",
            data: `You need to authorize the app to access your customer data. [Click here to authorize](${authResponse.url})`
          }
        };
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Tool call failed: ${response.status} ${error}`);
      }

      const result = await response.json();
      return result.result || result;
    } catch (error) {
      console.error(`Error calling tool ${toolName}:`, error);
      throw error;
    }
  }
}

export default MCPClient;

