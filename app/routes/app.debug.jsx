/**
 * Debug Dashboard
 * Admin view for monitoring AI chat interactions, token usage, and MCP tool calls
 */
import { useLoaderData, useRevalidator } from "react-router";
import { authenticate } from "../shopify.server";
import { getDebugData, clearDebugData } from "../services/debug.server";
import { useEffect, useState } from "react";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  const debugData = getDebugData();
  return { debugData };
};

export const action = async ({ request }) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");
  
  if (action === "clear") {
    clearDebugData();
  }
  
  return { success: true };
};

export default function DebugDashboard() {
  const { debugData } = useLoaderData();
  const revalidator = useRevalidator();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [expandedTools, setExpandedTools] = useState(new Set());
  const [expandedEvents, setExpandedEvents] = useState(new Set());

  const toggleToolExpanded = (index) => {
    const newExpanded = new Set(expandedTools);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedTools(newExpanded);
  };

  const toggleEventExpanded = (id) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedEvents(newExpanded);
  };

  const formatJson = (obj) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  // Auto-refresh every 3 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      revalidator.revalidate();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, revalidator]);

  const formatTimestamp = (ts) => {
    return new Date(ts).toLocaleTimeString();
  };

  const formatTokens = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getEventIcon = (type) => {
    switch (type) {
      case 'conversation_start': return '💬';
      case 'conversation_end': return '✅';
      case 'mcp_connection': return '🔗';
      case 'tool_call': return '🔧';
      case 'token_usage': return '📊';
      case 'message': return '💭';
      case 'error': return '❌';
      default: return '📝';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#22c55e';
      case 'completed': return '#3b82f6';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <s-page>
      <ui-title-bar title="🔍 Debug Dashboard - AI Chat Monitor" />
      
      {/* Stats Overview */}
      <s-section>
        <s-stack gap="loose">
          <s-inline gap="loose">
            <s-card>
              <s-stack gap="tight">
                <s-text variant="headingMd">📊 Token Usage</s-text>
                <s-inline gap="base">
                  <s-stack gap="extraTight">
                    <s-text variant="bodyMd" tone="subdued">Input</s-text>
                    <s-text variant="headingLg">{formatTokens(debugData.stats.totalTokensIn)}</s-text>
                  </s-stack>
                  <s-stack gap="extraTight">
                    <s-text variant="bodyMd" tone="subdued">Output</s-text>
                    <s-text variant="headingLg">{formatTokens(debugData.stats.totalTokensOut)}</s-text>
                  </s-stack>
                  <s-stack gap="extraTight">
                    <s-text variant="bodyMd" tone="subdued">Total</s-text>
                    <s-text variant="headingLg">{formatTokens(debugData.stats.totalTokensIn + debugData.stats.totalTokensOut)}</s-text>
                  </s-stack>
                </s-inline>
              </s-stack>
            </s-card>
            
            <s-card>
              <s-stack gap="tight">
                <s-text variant="headingMd">🔧 Tool Calls</s-text>
                <s-text variant="headingLg">{debugData.stats.totalToolCalls}</s-text>
              </s-stack>
            </s-card>
            
            <s-card>
              <s-stack gap="tight">
                <s-text variant="headingMd">💬 Conversations</s-text>
                <s-inline gap="base">
                  <s-stack gap="extraTight">
                    <s-text variant="bodyMd" tone="subdued">Total</s-text>
                    <s-text variant="headingLg">{debugData.stats.totalConversations}</s-text>
                  </s-stack>
                  <s-stack gap="extraTight">
                    <s-text variant="bodyMd" tone="subdued">Active</s-text>
                    <s-text variant="headingLg">{debugData.stats.activeConversations}</s-text>
                  </s-stack>
                </s-inline>
              </s-stack>
            </s-card>
          </s-inline>
          
          {/* Controls */}
          <s-inline gap="base">
            <s-button
              onClick={() => setAutoRefresh(!autoRefresh)}
              variant={autoRefresh ? "primary" : "secondary"}
            >
              {autoRefresh ? '⏸️ Pause Auto-Refresh' : '▶️ Resume Auto-Refresh'}
            </s-button>
            <s-button onClick={() => revalidator.revalidate()}>
              🔄 Refresh Now
            </s-button>
            <form method="post" style={{ display: 'inline' }}>
              <input type="hidden" name="action" value="clear" />
              <s-button type="submit" variant="destructive">
                🗑️ Clear All Data
              </s-button>
            </form>
          </s-inline>
        </s-stack>
      </s-section>

      {/* Two-column layout */}
      <s-inline gap="loose" blockAlign="start">
        {/* Recent Conversations */}
        <s-section heading="Recent Conversations" style={{ flex: 1, minWidth: '400px' }}>
          <s-stack gap="tight">
            {debugData.conversations.length === 0 ? (
              <s-text tone="subdued">No conversations yet. Chat with the AI to see data here.</s-text>
            ) : (
              debugData.conversations.map((conv) => (
                <s-card 
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  style={{ 
                    cursor: 'pointer',
                    borderLeft: `4px solid ${getStatusColor(conv.status)}`,
                    background: selectedConversation?.id === conv.id ? '#f0f9ff' : 'white'
                  }}
                >
                  <s-stack gap="extraTight">
                    <s-inline gap="base">
                      <s-badge tone={conv.status === 'active' ? 'info' : conv.status === 'error' ? 'critical' : 'success'}>
                        {conv.status}
                      </s-badge>
                      <s-text variant="bodySm" tone="subdued">
                        ID: {conv.id.substring(0, 10)}...
                      </s-text>
                    </s-inline>
                    <s-inline gap="loose">
                      <s-text variant="bodySm">
                        📊 {conv.tokenUsage.total} tokens
                      </s-text>
                      <s-text variant="bodySm">
                        🔧 {conv.toolCalls.length} tools
                      </s-text>
                      <s-text variant="bodySm">
                        💭 {conv.messages.length} msgs
                      </s-text>
                    </s-inline>
                    {conv.totalLatencyMs && (
                      <s-text variant="bodySm" tone="subdued">
                        ⏱️ {(conv.totalLatencyMs / 1000).toFixed(1)}s total
                      </s-text>
                    )}
                  </s-stack>
                </s-card>
              ))
            )}
          </s-stack>
        </s-section>

        {/* Conversation Detail / Event Stream */}
        <s-section heading={selectedConversation ? "Conversation Detail" : "Live Event Stream"} style={{ flex: 1, minWidth: '400px' }}>
          {selectedConversation ? (
            <s-stack gap="base">
              <s-button variant="tertiary" onClick={() => setSelectedConversation(null)}>
                ← Back to Event Stream
              </s-button>
              
              {/* Token Usage Bar */}
              <s-card>
                <s-stack gap="tight">
                  <s-text variant="headingSm">Token Usage</s-text>
                  <div style={{ display: 'flex', height: '24px', borderRadius: '4px', overflow: 'hidden', background: '#e5e7eb' }}>
                    <div 
                      style={{ 
                        width: `${(selectedConversation.tokenUsage.input / (selectedConversation.tokenUsage.total || 1)) * 100}%`,
                        background: '#3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '11px'
                      }}
                    >
                      In: {selectedConversation.tokenUsage.input}
                    </div>
                    <div 
                      style={{ 
                        width: `${(selectedConversation.tokenUsage.output / (selectedConversation.tokenUsage.total || 1)) * 100}%`,
                        background: '#22c55e',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '11px'
                      }}
                    >
                      Out: {selectedConversation.tokenUsage.output}
                    </div>
                  </div>
                </s-stack>
              </s-card>

              {/* MCP Connections */}
              {selectedConversation.mcpConnections.length > 0 && (
                <s-card>
                  <s-stack gap="tight">
                    <s-text variant="headingSm">🔗 MCP Connections</s-text>
                    {selectedConversation.mcpConnections.map((mcp, i) => (
                      <s-inline key={i} gap="base">
                        <s-badge>{mcp.serverType}</s-badge>
                        <s-text variant="bodySm">{mcp.toolCount} tools</s-text>
                        <s-text variant="bodySm" tone="subdued">{mcp.latencyMs}ms</s-text>
                      </s-inline>
                    ))}
                  </s-stack>
                </s-card>
              )}

              {/* Tool Calls */}
              {selectedConversation.toolCalls.length > 0 && (
                <s-card>
                  <s-stack gap="tight">
                    <s-text variant="headingSm">🔧 Tool Calls</s-text>
                    {selectedConversation.toolCalls.map((tool, i) => {
                      const isExpanded = expandedTools.has(i);
                      return (
                        <div 
                          key={i} 
                          style={{ 
                            padding: '12px', 
                            background: tool.success ? '#f0fdf4' : '#fef2f2', 
                            borderRadius: '8px', 
                            marginBottom: '8px',
                            border: `1px solid ${tool.success ? '#86efac' : '#fca5a5'}`
                          }}
                        >
                          <s-stack gap="tight">
                            {/* Header - always visible */}
                            <div 
                              onClick={() => toggleToolExpanded(i)}
                              style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                              <s-inline gap="base">
                                <s-text variant="bodyMd" fontWeight="semibold">{tool.toolName}</s-text>
                                <s-badge tone={tool.success ? 'success' : 'critical'}>
                                  {tool.success ? '✓ Success' : '✗ Failed'}
                                </s-badge>
                                <s-badge tone="info">⏱️ {tool.latencyMs}ms</s-badge>
                              </s-inline>
                              <s-text variant="bodySm" tone="subdued">
                                {isExpanded ? '▼ Collapse' : '▶ Expand'}
                              </s-text>
                            </div>
                            
                            {/* Expanded details */}
                            {isExpanded && (
                              <s-stack gap="tight">
                                {/* Arguments */}
                                <div style={{ marginTop: '8px' }}>
                                  <s-text variant="bodySm" fontWeight="semibold" tone="subdued">📥 Input Arguments:</s-text>
                                  <pre style={{ 
                                    background: '#1e293b', 
                                    color: '#e2e8f0', 
                                    padding: '12px', 
                                    borderRadius: '6px', 
                                    fontSize: '12px',
                                    overflow: 'auto',
                                    maxHeight: '200px',
                                    marginTop: '4px',
                                    fontFamily: 'Monaco, Consolas, monospace'
                                  }}>
                                    {formatJson(tool.toolArgs)}
                                  </pre>
                                </div>
                                
                                {/* Result */}
                                <div>
                                  <s-text variant="bodySm" fontWeight="semibold" tone="subdued">📤 Result:</s-text>
                                  <pre style={{ 
                                    background: '#1e293b', 
                                    color: '#e2e8f0', 
                                    padding: '12px', 
                                    borderRadius: '6px', 
                                    fontSize: '12px',
                                    overflow: 'auto',
                                    maxHeight: '300px',
                                    marginTop: '4px',
                                    fontFamily: 'Monaco, Consolas, monospace'
                                  }}>
                                    {tool.result}
                                  </pre>
                                </div>
                              </s-stack>
                            )}
                          </s-stack>
                        </div>
                      );
                    })}
                  </s-stack>
                </s-card>
              )}

              {/* Messages */}
              <s-card>
                <s-stack gap="tight">
                  <s-text variant="headingSm">💭 Messages</s-text>
                  {selectedConversation.messages.map((msg, i) => (
                    <s-inline key={i} gap="base">
                      <s-badge tone={msg.role === 'user' ? 'info' : 'success'}>{msg.role}</s-badge>
                      <s-text variant="bodySm">{msg.contentPreview}</s-text>
                    </s-inline>
                  ))}
                </s-stack>
              </s-card>
            </s-stack>
          ) : (
            <s-stack gap="extraTight">
              {debugData.recentEvents.length === 0 ? (
                <s-text tone="subdued">Waiting for events...</s-text>
              ) : (
                debugData.recentEvents.slice(0, 20).map((event) => {
                  const isExpanded = expandedEvents.has(event.id);
                  const isToolCall = event.type === 'tool_call';
                  
                  return (
                    <div 
                      key={event.id}
                      style={{ 
                        padding: '10px 12px',
                        background: event.type === 'error' ? '#fef2f2' : '#f9fafb',
                        borderRadius: '6px',
                        borderLeft: `4px solid ${event.type === 'error' ? '#ef4444' : event.type === 'tool_call' ? '#f59e0b' : '#3b82f6'}`,
                        cursor: isToolCall ? 'pointer' : 'default'
                      }}
                      onClick={() => isToolCall && toggleEventExpanded(event.id)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <s-inline gap="base">
                          <s-text>{getEventIcon(event.type)}</s-text>
                          <s-text variant="bodySm" fontWeight="medium">{event.type}</s-text>
                          <s-text variant="bodySm" tone="subdued">{formatTimestamp(event.timestamp)}</s-text>
                        </s-inline>
                        {isToolCall && (
                          <s-text variant="bodySm" tone="subdued">
                            {isExpanded ? '▼' : '▶'}
                          </s-text>
                        )}
                      </div>
                      
                      {event.type === 'tool_call' && (
                        <div style={{ marginTop: '4px' }}>
                          <s-inline gap="base">
                            <s-badge tone="warning">{event.toolName}</s-badge>
                            <s-badge tone="info">⏱️ {event.latencyMs}ms</s-badge>
                            <s-badge tone={event.success !== false ? 'success' : 'critical'}>
                              {event.success !== false ? '✓' : '✗'}
                            </s-badge>
                          </s-inline>
                          
                          {/* Expanded tool details */}
                          {isExpanded && (
                            <div style={{ marginTop: '8px' }}>
                              <s-text variant="bodySm" fontWeight="semibold" tone="subdued">📥 Arguments:</s-text>
                              <pre style={{ 
                                background: '#1e293b', 
                                color: '#e2e8f0', 
                                padding: '10px', 
                                borderRadius: '6px', 
                                fontSize: '11px',
                                overflow: 'auto',
                                maxHeight: '150px',
                                marginTop: '4px',
                                fontFamily: 'Monaco, Consolas, monospace'
                              }}>
                                {formatJson(event.toolArgs)}
                              </pre>
                              {event.resultPreview && (
                                <>
                                  <s-text variant="bodySm" fontWeight="semibold" tone="subdued" style={{ marginTop: '8px' }}>📤 Result Preview:</s-text>
                                  <pre style={{ 
                                    background: '#1e293b', 
                                    color: '#e2e8f0', 
                                    padding: '10px', 
                                    borderRadius: '6px', 
                                    fontSize: '11px',
                                    overflow: 'auto',
                                    maxHeight: '150px',
                                    marginTop: '4px',
                                    fontFamily: 'Monaco, Consolas, monospace'
                                  }}>
                                    {event.resultPreview}
                                  </pre>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {event.type === 'token_usage' && (
                        <div style={{ marginTop: '4px' }}>
                          <s-inline gap="tight">
                            <s-badge tone="info">📥 +{event.inputTokens} input</s-badge>
                            <s-badge tone="success">📤 +{event.outputTokens} output</s-badge>
                            <s-badge>📊 {event.totalTokens} total</s-badge>
                          </s-inline>
                        </div>
                      )}
                      
                      {event.type === 'mcp_connection' && (
                        <div style={{ marginTop: '4px' }}>
                          <s-inline gap="tight">
                            <s-badge tone="info">{event.serverType}</s-badge>
                            <s-badge tone="success">{event.toolCount} tools</s-badge>
                            <s-badge>⏱️ {event.latencyMs}ms</s-badge>
                          </s-inline>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </s-stack>
          )}
        </s-section>
      </s-inline>
    </s-page>
  );
}
