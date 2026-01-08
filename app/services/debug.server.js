/**
 * Debug Service
 * Tracks token usage, tool calls, MCP interactions, and timing metrics
 * for visualization in the admin panel
 */

// In-memory store for debug events (for demo purposes)
// In production, you'd want to use Redis or a database
const debugStore = {
  conversations: new Map(),
  recentEvents: [],
  stats: {
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalToolCalls: 0,
    totalConversations: 0,
  }
};

// Maximum events to keep in memory
const MAX_EVENTS = 100;
const MAX_CONVERSATIONS = 50;

/**
 * Creates a debug event entry
 * @param {string} type - Event type
 * @param {Object} data - Event data
 * @returns {Object} Debug event
 */
function createEvent(type, data) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    timestamp: new Date().toISOString(),
    ...data
  };
}

/**
 * Records a conversation start
 * @param {string} conversationId - Conversation ID
 * @param {string} shopDomain - Shop domain
 */
export function recordConversationStart(conversationId, shopDomain) {
  const conversation = {
    id: conversationId,
    shopDomain,
    startTime: Date.now(),
    messages: [],
    toolCalls: [],
    mcpConnections: [],
    tokenUsage: { input: 0, output: 0, total: 0 },
    status: 'active'
  };
  
  debugStore.conversations.set(conversationId, conversation);
  debugStore.stats.totalConversations++;
  
  // Clean up old conversations
  if (debugStore.conversations.size > MAX_CONVERSATIONS) {
    const oldestKey = debugStore.conversations.keys().next().value;
    debugStore.conversations.delete(oldestKey);
  }
  
  addEvent(createEvent('conversation_start', { conversationId, shopDomain }));
}

/**
 * Records MCP server connection
 * @param {string} conversationId - Conversation ID
 * @param {string} serverType - Server type (storefront/customer)
 * @param {string} serverUrl - Server URL
 * @param {number} toolCount - Number of tools available
 * @param {number} latencyMs - Connection latency in ms
 */
export function recordMcpConnection(conversationId, serverType, serverUrl, toolCount, latencyMs) {
  const conversation = debugStore.conversations.get(conversationId);
  if (conversation) {
    conversation.mcpConnections.push({
      serverType,
      serverUrl,
      toolCount,
      latencyMs,
      timestamp: Date.now()
    });
  }
  
  addEvent(createEvent('mcp_connection', {
    conversationId,
    serverType,
    serverUrl,
    toolCount,
    latencyMs
  }));
}

/**
 * Records a tool call
 * @param {string} conversationId - Conversation ID
 * @param {string} toolName - Tool name
 * @param {Object} toolArgs - Tool arguments
 * @param {Object} result - Tool result
 * @param {number} latencyMs - Call latency in ms
 * @param {boolean} success - Whether the call succeeded
 */
export function recordToolCall(conversationId, toolName, toolArgs, result, latencyMs, success = true) {
  const conversation = debugStore.conversations.get(conversationId);
  const toolCall = {
    toolName,
    toolArgs,
    result: truncateResult(result),
    latencyMs,
    success,
    timestamp: Date.now()
  };
  
  if (conversation) {
    conversation.toolCalls.push(toolCall);
  }
  
  debugStore.stats.totalToolCalls++;
  
  addEvent(createEvent('tool_call', {
    conversationId,
    toolName,
    toolArgs,
    latencyMs,
    success,
    resultPreview: typeof result === 'string' ? result.substring(0, 200) : JSON.stringify(result).substring(0, 200)
  }));
}

/**
 * Records token usage from Claude response
 * @param {string} conversationId - Conversation ID
 * @param {number} inputTokens - Input tokens used
 * @param {number} outputTokens - Output tokens generated
 */
export function recordTokenUsage(conversationId, inputTokens, outputTokens) {
  const conversation = debugStore.conversations.get(conversationId);
  if (conversation) {
    conversation.tokenUsage.input += inputTokens;
    conversation.tokenUsage.output += outputTokens;
    conversation.tokenUsage.total += inputTokens + outputTokens;
  }
  
  debugStore.stats.totalTokensIn += inputTokens;
  debugStore.stats.totalTokensOut += outputTokens;
  
  addEvent(createEvent('token_usage', {
    conversationId,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens
  }));
}

/**
 * Records a message in the conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} role - Message role (user/assistant)
 * @param {string} content - Message content preview
 */
export function recordMessage(conversationId, role, content) {
  const conversation = debugStore.conversations.get(conversationId);
  if (conversation) {
    conversation.messages.push({
      role,
      contentPreview: typeof content === 'string' ? content.substring(0, 100) : '[complex content]',
      timestamp: Date.now()
    });
  }
  
  addEvent(createEvent('message', {
    conversationId,
    role,
    contentPreview: typeof content === 'string' ? content.substring(0, 100) : '[complex content]'
  }));
}

/**
 * Records conversation completion
 * @param {string} conversationId - Conversation ID
 * @param {number} totalLatencyMs - Total conversation latency
 */
export function recordConversationEnd(conversationId, totalLatencyMs) {
  const conversation = debugStore.conversations.get(conversationId);
  if (conversation) {
    conversation.status = 'completed';
    conversation.endTime = Date.now();
    conversation.totalLatencyMs = totalLatencyMs;
  }
  
  addEvent(createEvent('conversation_end', {
    conversationId,
    totalLatencyMs
  }));
}

/**
 * Records an error
 * @param {string} conversationId - Conversation ID
 * @param {string} errorType - Error type
 * @param {string} errorMessage - Error message
 */
export function recordError(conversationId, errorType, errorMessage) {
  const conversation = debugStore.conversations.get(conversationId);
  if (conversation) {
    conversation.status = 'error';
    conversation.error = { type: errorType, message: errorMessage };
  }
  
  addEvent(createEvent('error', {
    conversationId,
    errorType,
    errorMessage
  }));
}

/**
 * Gets all debug data
 * @returns {Object} Complete debug data
 */
export function getDebugData() {
  const conversations = Array.from(debugStore.conversations.values())
    .sort((a, b) => b.startTime - a.startTime)
    .slice(0, 20);
  
  return {
    stats: {
      ...debugStore.stats,
      activeConversations: Array.from(debugStore.conversations.values())
        .filter(c => c.status === 'active').length
    },
    conversations,
    recentEvents: debugStore.recentEvents.slice(0, 50)
  };
}

/**
 * Gets debug data for a specific conversation
 * @param {string} conversationId - Conversation ID
 * @returns {Object|null} Conversation debug data
 */
export function getConversationDebug(conversationId) {
  return debugStore.conversations.get(conversationId) || null;
}

/**
 * Clears all debug data
 */
export function clearDebugData() {
  debugStore.conversations.clear();
  debugStore.recentEvents = [];
  debugStore.stats = {
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalToolCalls: 0,
    totalConversations: 0,
  };
}

/**
 * Adds an event to the recent events list
 * @param {Object} event - Event to add
 */
function addEvent(event) {
  debugStore.recentEvents.unshift(event);
  if (debugStore.recentEvents.length > MAX_EVENTS) {
    debugStore.recentEvents.pop();
  }
}

/**
 * Truncates result for storage
 * @param {any} result - Result to truncate
 * @returns {string} Truncated result
 */
function truncateResult(result) {
  const str = typeof result === 'string' ? result : JSON.stringify(result);
  return str.length > 500 ? str.substring(0, 500) + '...' : str;
}

export default {
  recordConversationStart,
  recordMcpConnection,
  recordToolCall,
  recordTokenUsage,
  recordMessage,
  recordConversationEnd,
  recordError,
  getDebugData,
  getConversationDebug,
  clearDebugData
};
