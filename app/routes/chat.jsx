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

    if (request.method === "POST") {
      const body = await request.json();
      message = body.message;
      conversation_id = body.conversation_id;
    } else {
      const url = new URL(request.url);
      message = url.searchParams.get("message");
      conversation_id = url.searchParams.get("conversation_id");
    }

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers }
      );
    }

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
          const mcpClient = new MCPClient(request.headers.get("origin"));
          let availableTools = [];

          try {
            // Connect to MCP server and get available tools
            availableTools = await mcpClient.connectToServer();
            console.log(`Connected to MCP with ${availableTools.length} tools`);
          } catch (error) {
            console.warn('Failed to connect to MCP server, continuing without tools:', error.message);
          }

          // Get or create conversation history
          let conversationHistory = [];
          if (conversation_id && conversations.has(conversation_id)) {
            conversationHistory = conversations.get(conversation_id);
          }

          // Add user message to history
          let userMessage = { role: 'user', content: message };
          conversationHistory.push(userMessage);

          // Get system prompt from JSON file
          // You can easily switch between different prompts by changing which one is used here
          const promptType = "standardAssistant"; // Can be changed to "enthusiasticAssistant" or others
          const systemInstruction = systemPrompts.systemPrompts[promptType].content;

          // Generate or use existing conversation ID
          const newConversationId = conversation_id || Date.now().toString();

          // Send the conversation ID to the client
          sendMessage({ type: 'id', conversation_id: newConversationId });

          let finalMessage = userMessage;

          // Generate response from Claude using streaming
          while (finalMessage.stop_reason !== "end_turn") {
            const stream = await anthropic.messages.stream({
              model: 'claude-3-5-sonnet-latest',
              max_tokens: 1000,
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
            });

            finalMessage = await stream.finalMessage();
            for (const content of finalMessage.content) {
              if (content.type === "tool_use") {
                const toolName = content.name;
                const toolArgs = content.input;
                const toolUseId = content.id;
                const toolUseResponse = await mcpClient.callTool(toolName, toolArgs);
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

          // Store updated conversation history
          conversations.set(newConversationId, conversationHistory);

          // Send a completion message
          sendMessage({ type: 'done' });
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

