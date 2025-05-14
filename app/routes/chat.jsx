import { json } from "@remix-run/node";
import { Anthropic } from "@anthropic-ai/sdk";
import MCPClient from "../mcp-client";
import systemPrompts from "../prompts/prompts.json";
import { saveMessage, getConversationHistory } from "../db.server";

// This route is now API-only. Only requests with Accept: text/event-stream are supported.
export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    // Allow cross-origin requests from any origin
    const origin = request.headers.get("Origin") || "*";
    const requestHeaders = request.headers.get("Access-Control-Request-Headers") || "Content-Type, Accept";
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": requestHeaders,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400" // 24 hours
      },
    });
  }

  const url = new URL(request.url);

  // Handle history fetch requests - matches /chat?history=true&conversation_id=XYZ
  if (url.searchParams.has('history') && url.searchParams.has('conversation_id')) {
    const conversationId = url.searchParams.get('conversation_id');
    const messages = await getConversationHistory(conversationId);

    // Set CORS headers for history endpoint
    const origin = request.headers.get("Origin") || "*";
    const requestHeaders = request.headers.get("Access-Control-Request-Headers") || "Content-Type, Accept";
    return json({ messages }, {
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": requestHeaders,
        "Access-Control-Allow-Credentials": "true"
      }
    });
  }

  // If it's not a history request, check if it's an SSE request
  if (!url.searchParams.has('history') && request.headers.get("Accept") === "text/event-stream") {
    return handleChatRequest(request);
  }

  // API-only: reject all other requests that don't match any of the above conditions
  return json({ error: "This endpoint only supports server-sent events (SSE) requests or history requests." }, { status: 400 });
}

// Common handler for chat requests (both GET and POST)
async function handleChatRequest(request) {
  // Set headers for SSE and CORS
  const origin = request.headers.get("Origin") || "*";
  const headers = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,OPTIONS,POST",
    "Access-Control-Allow-Headers": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  };

  try {
    // Get message from request (either from JSON body or URL params)
    let message, conversation_id;

    const body = await request.json();
    message = body.message;
    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers }
      );
    }

    // Generate or use existing conversation ID
    conversation_id = body.conversation_id || Date.now().toString();

    // Create a stream for the response
    const encoder = new TextEncoder();
    const responseStream = new ReadableStream({
      async start(controller) {
        const sendMessage = (data) => {
          const text = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(text));
        };

        try {
          // Initialize Claude client
          const anthropic = new Anthropic({
            apiKey: process.env.CLAUDE_API_KEY
          });


          // Initialize MCP client
          const shopId = request.headers.get("X-Shopify-Shop-Id");
          const mcpClient = new MCPClient(request.headers.get("origin"), conversation_id, shopId);


          try {
            // Connect to MCP server and get available tools
            const storefrontMcpTools = await mcpClient.connectToStorefrontServer();
            const customerMcpTools = await mcpClient.connectToCustomerServer();

            console.log(`Connected to MCP with ${storefrontMcpTools.length} tools`);
            console.log(`Connected to customer MCP with ${customerMcpTools.length} tools`);
          } catch (error) {
            console.warn('Failed to connect to MCP servers, continuing without tools:', error.message);
          }

          // Get or create conversation history
          let conversationHistory = [];
          let productsToDisplay = [];

          // Save user message to the database
          await saveMessage(conversation_id, 'user', message);

          // Fetch all messages from the database for this conversation
          const dbMessages = await getConversationHistory(conversation_id);

          // Format messages for Claude API
          conversationHistory = dbMessages.map(dbMessage => ({
            role: dbMessage.role,
            content: dbMessage.content
          }));

          // Add current user message to memory (it's already in the database)
          let userMessage = { role: 'user', content: message };

          // Get system prompt from request or use default
          const promptType = body.prompt_type || "standardAssistant";
          const systemInstruction = systemPrompts.systemPrompts[promptType].content;

          sendMessage({ type: 'id', conversation_id: conversation_id });

          let finalMessage = userMessage;
          let userActionRequired = false;

          while (finalMessage.stop_reason !== "end_turn" && !userActionRequired) {
            const stream = await anthropic.messages.stream({
              model: 'claude-3-5-sonnet-latest',
              max_tokens: 2000,
              system: systemInstruction,
              messages: conversationHistory,
              tools: mcpClient.tools.length > 0 ? mcpClient.tools : undefined
            })
            .on('text', (textDelta) => {
              sendMessage({
                type: 'chunk',
                chunk: textDelta
              });
            })
            .on('message', (message) => {
              for (const content of message.content) {
                // Store message in memory
                conversationHistory.push({role: message.role, content: [content]});

                // Save message to database if it's text content
                if (content.type === "text") {
                  saveMessage(conversation_id, message.role, content.text)
                    .then()
                    .catch((error) => {
                      console.error("Error saving message to database:", error);
                    });
                }
              }

              // Send a completion message
              sendMessage({ type: 'message_complete' });
            });

            finalMessage = await stream.finalMessage();
            for (const content of finalMessage.content) {
              if (content.type === "tool_use") {
                const toolName = content.name;
                const toolArgs = content.input;
                const toolUseId = content.id;
                const toolUseResponse = await mcpClient.callTool(toolName, toolArgs);

                if (toolUseResponse.error) {
                  await handleToolError(toolUseResponse, toolName, toolUseId, conversationHistory, sendMessage, conversation_id);
                } else {
                  await handleToolSuccess(toolUseResponse, toolName, toolUseId, conversationHistory, productsToDisplay, conversation_id);
                }

                sendMessage({ type: 'new_message' });
              }
            }
          }

          sendMessage({ type: 'end_turn' });

          // Send product results if available
          if (productsToDisplay.length > 0) {
            sendMessage({
              type: 'product_results',
              products: productsToDisplay
            });
          }

          controller.close();
        } catch (error) {
          handleStreamingError(error, sendMessage);
          controller.close();
        }
      }
    });

    return new Response(responseStream, { headers });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}

// Helper functions for tool response handling
async function handleToolError(toolUseResponse, toolName, toolUseId, conversationHistory, sendMessage, conversationId) {
  if (toolUseResponse.error.type === "auth_required") {
    console.log("Auth required for tool:", toolName);
    await addToolResultToHistory(conversationHistory, toolUseId, toolUseResponse.error.data, conversationId);
    sendMessage({ type: 'auth_required' });
  } else {
    console.log("Tool use error", toolUseResponse.error);
    await addToolResultToHistory(conversationHistory, toolUseId, toolUseResponse.error.data, conversationId);
  }
}

async function handleToolSuccess(toolUseResponse, toolName, toolUseId, conversationHistory, productsToDisplay, conversationId) {
  // Check if this is a product search result
  if (toolName === "search_shop_catalog") {
    productsToDisplay.push(...processProductSearchResult(toolUseResponse))
  }

  // Continue with normal tool result processing
  for (const content of toolUseResponse.content) {
    const toolUseResponseMessage = {
      role: 'user',
      content: [{
        type: "tool_result",
        tool_use_id: toolUseId,
        content: content.text
      }]
    };

    // Add to in-memory history
    conversationHistory.push(toolUseResponseMessage);

    // Save to database
    if (conversationId) {
      try {
        await saveMessage(conversationId, 'user', JSON.stringify({
          type: "tool_result",
          tool_use_id: toolUseId,
          content: content.text
        }));
      } catch (error) {
        console.error('Error saving tool result to database:', error);
      }
    }
  }
}

// Helper function to process product search results
function processProductSearchResult(toolUseResponse) {
  try {
    console.log("Processing product search result");
    let products = [];
    if (toolUseResponse.content && toolUseResponse.content.length > 0) {
      const content = toolUseResponse.content[0].text;
      try {
        let responseData;
        if (typeof content === 'object') {
          responseData = content;
        } else if (typeof content === 'string') {
          responseData = JSON.parse(content);
        }
        if (responseData && responseData.products && Array.isArray(responseData.products)) {
          products = responseData.products.slice(0, 3).map(product => {
            const price = product.price_range
              ? `${product.price_range.currency} ${product.price_range.min}`
              : (product.variants && product.variants.length > 0
                  ? `${product.variants[0].currency} ${product.variants[0].price}`
                  : 'Price not available');
            return {
              id: product.product_id || `product-${Math.random().toString(36).substring(7)}`,
              title: product.title || 'Product',
              price: price,
              image_url: product.image_url || '',
              description: product.description || '',
              url: product.url || ''
            };
          });
          console.log(`Found ${products.length} products to display`);
        }
      } catch (e) {
        console.error("Error parsing product data:", e);
      }
    }

    return products;
  } catch (error) {
    console.error("Error processing product search results:", error);
  }
}

async function addToolResultToHistory(conversationHistory, toolUseId, content, conversationId) {
  const toolResultMessage = {
    role: 'user',
    content: [{
      type: "tool_result",
      tool_use_id: toolUseId,
      content: content
    }]
  };

  // Add to in-memory history
  conversationHistory.push(toolResultMessage);

  // Save to database with special format to indicate tool result
  if (conversationId) {
    try {
      await saveMessage(conversationId, 'user', JSON.stringify({
        type: "tool_result",
        tool_use_id: toolUseId,
        content: content
      }));
    } catch (error) {
      console.error('Error saving tool result to database:', error);
    }
  }
}

function handleStreamingError(error, sendMessage) {
  console.error('Error processing streaming request:', error);

  if (error.status === 401 || error.message.includes('auth') || error.message.includes('key')) {
    sendMessage({
      type: 'error',
      error: 'Authentication failed with Claude API',
      details: 'Please check your API key in environment variables',
      message: error.message
    });
  } else if (error.status === 529 || error.message.includes('Overloaded')) {
    sendMessage({
      type: 'rate_limit_exceeded',
      error: 'Rate limit exceeded',
      details: 'Please try again later'
    });
  } else {
    sendMessage({
      type: 'error',
      error: 'Failed to get response from Claude',
      details: error.message
    });
  }
}

export async function action({ request }) {
  // For POST requests, use the same handler
  return handleChatRequest(request);
}

