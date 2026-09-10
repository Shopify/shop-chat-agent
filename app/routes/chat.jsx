/**
 * Chat API Route
 * Handles chat interactions with Claude API and tools
 */
import { json } from "@remix-run/node";
import MCPClient from "../mcp-client";
import { saveMessage, getConversationHistory, storeCustomerAccountUrl, getCustomerAccountUrl } from "../db.server";
import AppConfig from "../services/config.server";
import { createSseStream } from "../services/streaming.server";
import { createClaudeService } from "../services/claude.server";
import { createToolService } from "../services/tool.server";
import { localTools, executeLocalTool } from "../services/local-tools.server";
import { unauthenticated } from "../shopify.server";


/**
 * Remix loader function for handling GET requests
 */
export async function loader({ request }) {
  // Handle OPTIONS requests (CORS preflight)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request)
    });
  }

  const url = new URL(request.url);

  // Handle history fetch requests - matches /chat?history=true&conversation_id=XYZ
  if (url.searchParams.has('history') && url.searchParams.has('conversation_id')) {
    return handleHistoryRequest(request, url.searchParams.get('conversation_id'));
  }

  // Handle SSE requests
  if (!url.searchParams.has('history') && request.headers.get("Accept") === "text/event-stream") {
    return handleChatRequest(request);
  }

  // API-only: reject all other requests
  return json(
    { error: AppConfig.errorMessages.apiUnsupported },
    { status: 400, headers: getCorsHeaders(request) }
  );
}

/**
 * Remix action function for handling POST requests
 */
export async function action({ request }) {
  return handleChatRequest(request);
}

/**
 * Handle history fetch requests
 * @param {Request} request - The request object
 * @param {string} conversationId - The conversation ID
 * @returns {Response} JSON response with chat history
 */
async function handleHistoryRequest(request, conversationId) {
  const messages = await getConversationHistory(conversationId);

  return json(
    { messages },
    { headers: getCorsHeaders(request) }
  );
}

/**
 * Handle chat requests (both GET and POST)
 * @param {Request} request - The request object
 * @returns {Response} Server-sent events stream
 */
async function handleChatRequest(request) {
  try {
    // Get message data from request body
    const body = await request.json();
    const userMessage = body.message;

    // Validate required message
    if (!userMessage) {
      return new Response(
        JSON.stringify({ error: AppConfig.errorMessages.missingMessage }),
        { status: 400, headers: getSseHeaders(request) }
      );
    }

    // Generate or use existing conversation ID
    const conversationId = body.conversation_id || Date.now().toString();
    const promptType = body.prompt_type || AppConfig.api.defaultPromptType;

    // Create a stream for the response
    const responseStream = createSseStream(async (stream) => {
      await handleChatSession({
        request,
        userMessage,
        conversationId,
        promptType,
        stream
      });
    });

    return new Response(responseStream, {
      headers: getSseHeaders(request)
    });
  } catch (error) {
    console.error('Error in chat request handler:', error);
    return json({ error: error.message }, {
      status: 500,
      headers: getCorsHeaders(request)
    });
  }
}

/**
 * Handle a complete chat session
 * @param {Object} params - Session parameters
 * @param {Request} params.request - The request object
 * @param {string} params.userMessage - The user's message
 * @param {string} params.conversationId - The conversation ID
 * @param {string} params.promptType - The prompt type
 * @param {Object} params.stream - Stream manager for sending responses
 */
async function handleChatSession({
  request,
  userMessage,
  conversationId,
  promptType,
  stream
}) {
  // Initialize services
  const claudeService = createClaudeService();
  const toolService = createToolService();

  // Initialize MCP client
  const shopId = request.headers.get("X-Shopify-Shop-Id");
  // Origin can be absent, the literal string "null" (sandboxed iframes), or
  // malformed. Normalize to "<protocol>//<host>" or null; a null shopDomain
  // means MCP endpoints can't be built and every MCP connect is skipped.
  const shopDomain = normalizeOrigin(request.headers.get("Origin"));
  if (!shopDomain) {
    console.warn(`chat: unusable Origin header "${request.headers.get("Origin")}"; MCP tools disabled for this request`);
  }
  const customerMcpEndpoint = shopDomain
    ? await getCustomerMcpEndpoint(shopDomain, conversationId)
    : null;
  const mcpClient = new MCPClient(
    shopDomain,
    conversationId,
    shopId,
    customerMcpEndpoint
  );

  try {
    // Send conversation ID to client
    stream.sendMessage({ type: 'id', conversation_id: conversationId });

    // Connect to MCP servers and get available tools
    let storefrontMcpTools = [], customerMcpTools = [], ucpMcpTools = [];

    try {
      storefrontMcpTools = await mcpClient.connectToStorefrontServer();
      customerMcpTools = await mcpClient.connectToCustomerServer();

      console.log(`Connected to MCP with ${storefrontMcpTools.length} storefront tools`);
      console.log(`Connected to customer MCP with ${customerMcpTools.length} customer tools`);
    } catch (error) {
      console.warn('Failed to connect to MCP servers, continuing without tools:', error.message);
    }

    // UCP catalog is isolated so a discovery failure doesn't also drop the
    // storefront / customer tools.
    try {
      ucpMcpTools = await mcpClient.connectToUcpServer();
      console.log(`Connected to UCP MCP with ${ucpMcpTools.length} catalog tools`);
    } catch (error) {
      console.warn('Failed to connect to UCP MCP, continuing without catalog search:', error.message);
    }

    // Add local tools to the available tools
    mcpClient.tools = [...mcpClient.tools, ...localTools];
    console.log(`Added ${localTools.length} local tools. Total tools: ${mcpClient.tools.length}`);

    // Prepare conversation state
    let conversationHistory = [];
    let productsToDisplay = [];
    let cartActionsToDisplay = [];
    // Assistant-message save promises; awaited before each turn's tool_result
    // row is written so history rows stay in a valid order.
    const pendingSaves = [];

    // Save user message to the database
    await saveMessage(conversationId, 'user', userMessage);

    // Fetch all messages from the database for this conversation
    const dbMessages = await getConversationHistory(conversationId);

    // Format messages for Claude API
    conversationHistory = dbMessages.map(dbMessage => {
      let content;
      try {
        content = JSON.parse(dbMessage.content);
      } catch (e) {
        content = dbMessage.content;
      }
      return {
        role: dbMessage.role,
        content
      };
    });

    // Execute the conversation stream
    let finalMessage = { role: 'user', content: userMessage };
    let turn = 0;

    // Loop only while Claude has more work to do (tool_use / pause_turn). Every
    // other stop_reason ends the turn — with a short fallback for the ones that
    // aren't a clean finish.
    while (true) {
      turn += 1;

      // Every tool_result for this assistant turn is collected here and flushed
      // as ONE user message; separate rows per parallel tool_use block would be
      // an invalid Messages API shape.
      const toolResults = [];

      finalMessage = await claudeService.streamConversation(
        {
          messages: conversationHistory,
          promptType,
          tools: mcpClient.tools
        },
        {
          // Handle text chunks
          onText: (textDelta) => {
            stream.sendMessage({
              type: 'chunk',
              chunk: textDelta
            });
          },

          // Handle complete messages
          onMessage: (message) => {
            conversationHistory.push({
              role: message.role,
              content: message.content
            });

            pendingSaves.push(
              saveMessage(conversationId, message.role, JSON.stringify(message.content))
                .catch((error) => {
                  console.error("Error saving message to database:", error);
                })
            );

            // Send a completion message
            stream.sendMessage({ type: 'message_complete' });
          },

          // Block the tool-use step until assistant saves have settled
          awaitSaves: () => Promise.all(pendingSaves),

          // Handle tool use requests
          onToolUse: async (content) => {
            const toolName = content.name;
            const toolArgs = content.input;
            const toolUseId = content.id;

            const toolUseMessage = `Уточнюю інформацію...`;
            //const toolUseMessage = `Calling tool: ${toolName} with arguments: ${JSON.stringify(toolArgs)}`;

            stream.sendMessage({
              type: 'tool_use',
              tool_use_message: toolUseMessage
            });

            // Check if it's a local tool
            const isLocalTool = localTools.some(tool => tool.name === toolName);

            try {
              // Call the appropriate tool
              let toolUseResponse;
              if (isLocalTool) {
                console.log(`Executing local tool: ${toolName}`);
                toolUseResponse = await executeLocalTool(toolName, toolArgs);
              } else {
                console.log(`Calling MCP tool: ${toolName}`);
                toolUseResponse = await mcpClient.callTool(toolName, toolArgs);
              }

              // Handle tool response based on success/error
              if (toolUseResponse.error) {
                toolService.handleToolError(
                  toolUseResponse,
                  toolName,
                  toolUseId,
                  toolResults,
                  stream.sendMessage
                );
              } else {
                toolService.handleToolSuccess(
                  toolUseResponse,
                  toolName,
                  toolUseId,
                  toolResults,
                  productsToDisplay,
                  cartActionsToDisplay
                );
              }
            } catch (error) {
              // A thrown tool call still has to leave exactly one tool_result
              // for this block, or the next request is a malformed user->user.
              console.error(`Tool ${toolName} threw:`, error);
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUseId,
                content: `Не вдалося виконати інструмент ${toolName}: ${error.message}`,
                is_error: true
              });
            }

            // Signal new message to client
            stream.sendMessage({ type: 'new_message' });
          },

          // Handle content block completion
          onContentBlock: (contentBlock) => {
            if (contentBlock.type === 'text') {
              stream.sendMessage({
                type: 'content_block_complete',
                content_block: contentBlock
              });
            }
          }
        }
      );

      // One user message carrying every tool_result for the turn just finished.
      await toolService.flushToolResults(conversationHistory, toolResults, conversationId);

      const stopReason = finalMessage.stop_reason;

      // More work to do — go round again, unless we've hit the safety cap.
      if (stopReason === "tool_use" || stopReason === "pause_turn") {
        if (turn >= AppConfig.api.maxToolTurns) {
          console.warn(`Tool loop hit maxToolTurns (${AppConfig.api.maxToolTurns}) for ${conversationId}`);
          const capMessage = 'Це запитання виявилося складнішим за очікуване. Уточніть, будь ласка, деталі або зверніться до менеджера.';
          stream.sendMessage({ type: 'chunk', chunk: '\n\n' + capMessage });
          stream.sendMessage({ type: 'message_complete' });
          // Persist a real assistant turn so history stays role-alternating
          // (the loop broke right after a user tool_result row).
          try {
            await saveMessage(conversationId, 'assistant', JSON.stringify([{ type: 'text', text: capMessage }]));
          } catch (error) {
            console.error("Error saving cap message to database:", error);
          }
        } else {
          continue;
        }
      } else if (stopReason === "max_tokens") {
        stream.sendMessage({
          type: 'chunk',
          chunk: '\n\n(Відповідь була обрізана. Попросіть продовжити або звузьте запит.)'
        });
        stream.sendMessage({ type: 'message_complete' });
      } else if (stopReason === "refusal") {
        stream.sendMessage({
          type: 'chunk',
          chunk: '\n\nВибачте, я не можу відповісти на це запитання. Зверніться, будь ласка, до менеджера.'
        });
        stream.sendMessage({ type: 'message_complete' });
      }
      // end_turn, stop_sequence, or anything else: nothing extra to send.

      break;
    }

    // Signal end of turn
    stream.sendMessage({ type: 'end_turn' });

    // Send product results if available
    if (productsToDisplay.length > 0) {
      stream.sendMessage({
        type: 'product_results',
        products: productsToDisplay
      });
    }

    // Tell the client to write any resolved add-to-cart actions to the
    // shopper's real storefront cart (the backend never writes it directly)
    if (cartActionsToDisplay.length > 0) {
      stream.sendMessage({
        type: 'cart_add',
        actions: cartActionsToDisplay
      });
    }
  } catch (error) {
    // The streaming handler takes care of error handling
    throw error;
  }
}

/**
 * Normalizes an Origin header to "<protocol>//<host>", or null if it's absent,
 * the literal string "null", or not a valid URL.
 * @param {string|null} origin
 * @returns {string|null}
 */
function normalizeOrigin(origin) {
  if (!origin || origin === "null") return null;
  try {
    const url = new URL(origin);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * Get the customer MCP endpoint for a shop
 * @param {string} shopDomain - The shop domain (already normalized, non-null)
 * @param {string} conversationId - The conversation ID
 * @returns {string} The customer MCP endpoint
 */
async function getCustomerMcpEndpoint(shopDomain, conversationId) {
  try {
    // Check if the customer account URL exists in the DB
    const existingUrl = await getCustomerAccountUrl(conversationId);

    // If URL exists, return early with the MCP endpoint
    if (existingUrl) {
      return `${existingUrl}/customer/api/mcp`;
    }

    // If not, query for it from the Shopify API
    const { hostname } = new URL(shopDomain);
    const { storefront } = await unauthenticated.storefront(
      hostname
    );

    const response = await storefront.graphql(
      `#graphql
      query shop {
        shop {
          customerAccountUrl
        }
      }`,
    );

    const body = await response.json();
    const customerAccountUrl = body.data.shop.customerAccountUrl;

    // Store the customer account URL with conversation ID in the DB
    await storeCustomerAccountUrl(conversationId, customerAccountUrl);

    return `${customerAccountUrl}/customer/api/mcp`;
  } catch (error) {
    console.error("Error getting customer MCP endpoint:", error);
    return null;
  }
}

/**
 * Gets CORS headers for the response
 * @param {Request} request - The request object
 * @returns {Object} CORS headers object
 */
function getCorsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  const requestHeaders = request.headers.get("Access-Control-Request-Headers") || "Content-Type, Accept";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": requestHeaders,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400" // 24 hours
  };
}

/**
 * Get SSE headers for the response
 * @param {Request} request - The request object
 * @returns {Object} SSE headers object
 */
function getSseHeaders(request) {
  const origin = request.headers.get("Origin") || "*";

  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,OPTIONS,POST",
    "Access-Control-Allow-Headers": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  };
}
