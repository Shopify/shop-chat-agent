import { json } from "@remix-run/node";
import { Anthropic } from "@anthropic-ai/sdk";
import MCPClient from "../mcp-client";
import systemPrompts from "../prompts/prompts.json";

// Simple memory store for conversations (in production, use a database)
const conversations = new Map();

// This route is now API-only. Only requests with Accept: text/event-stream are supported.
export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Accept",
      },
    });
  }

  if (request.headers.get("Accept") === "text/event-stream") {
    return handleChatRequest(request);
  }
  // API-only: reject all other requests
  return json({ error: "This endpoint only supports server-sent events (SSE) requests." }, { status: 400 });
}

// Common handler for chat requests (both GET and POST)
async function handleChatRequest(request) {
  // Set headers for SSE and CORS
  const headers = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Origin": "*",
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
          const mcpClient = new MCPClient(request.headers.get("origin"), conversation_id);

          // Get customer token from request header if available
          const customerAccessToken = request.headers.get("Customer-Access-Token");


          try {
            // Connect to MCP server and get available tools
            const storefrontMcpTools = await mcpClient.connectToStorefrontServer();
            const customerMcpTools = await mcpClient.connectToCustomerServer(customerAccessToken);

            console.log(`Connected to MCP with ${storefrontMcpTools.length} tools`);
            console.log(`Connected to customer MCP with ${customerMcpTools.length} tools`);
          } catch (error) {
            console.warn('Failed to connect to MCP servers, continuing without tools:', error.message);
          }

          // Get or create conversation history
          let conversationHistory = [];
          if (conversation_id && conversations.has(conversation_id)) {
            conversationHistory = conversations.get(conversation_id);
          }

          // Add user message to history
          let userMessage = { role: 'user', content: message };
          conversationHistory.push(userMessage);

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
                conversationHistory.push({role: message.role, content: [content]});
              }

              // Send a completion message
              sendMessage({ type: 'done' });
            });

            finalMessage = await stream.finalMessage();
            for (const content of finalMessage.content) {
              if (content.type === "tool_use") {
                const toolName = content.name;
                const toolArgs = content.input;
                const toolUseId = content.id;
                const toolUseResponse = await mcpClient.callTool(toolName, toolArgs);

                // TODO: Move this to error handling below
                // Check if this is an auth error response
                if (toolUseResponse.error === "authorization_required") {
                  // Handle auth error - send special message with auth URL
                  sendMessage({
                    type: 'auth_required',
                    auth_url: toolUseResponse.auth_url
                  });
                  userActionRequired = true;

                  // Add the auth message to conversation history
                  conversationHistory.push({
                    role: 'user',
                    content: [{
                      type: "tool_result",
                      tool_use_id: toolUseId,
                      content: toolUseResponse.text
                    }]
                  });
                } else if (toolUseResponse.error) {
                  console.log("Tool use error", toolUseResponse.error);
                  // TODO: Handle other tool errors
                  conversationHistory.push({
                    role: 'user',
                    content: [{
                      type: "tool_result",
                      tool_use_id: toolUseId,
                      content: toolUseResponse.error.data
                    }]
                  });

                  sendMessage({ type: 'new_message' });
                } else {
                  // Normal tool response
                  for (const content of toolUseResponse.content) {
                    const toolUseResponseMessage = {
                      role: 'user',
                      content: [{
                        type: "tool_result",
                        tool_use_id: toolUseId,
                        content: content.text
                      }]
                    };
                    conversationHistory.push(toolUseResponseMessage);
                  }

                  sendMessage({ type: 'new_message' });
                }
              }
            }
          }

          // Store updated conversation history
          conversations.set(conversation_id, conversationHistory);
          controller.close();
        } catch (error) {
          console.error('Error processing streaming request:', error);

          // Check for specific error types
          if (error.status === 401 || error.message.includes('auth') || error.message.includes('key')) {
            sendMessage({
              type: 'error',
              error: 'Authentication failed with Claude API',
              details: 'Please check your API key in environment variables',
              message: error.message
            });
          } else if (error.status === 529) {
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
          controller.close();
        }
      }
    });

    return new Response(responseStream, { headers });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function action({ request }) {
  // For POST requests, use the same handler
  return handleChatRequest(request);
}

