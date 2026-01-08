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
                    {selectedConversation.toolCalls.map((tool, i) => (
                      <div key={i} style={{ padding: '8px', background: tool.success ? '#f0fdf4' : '#fef2f2', borderRadius: '4px', marginBottom: '4px' }}>
                        <s-stack gap="extraTight">
                          <s-inline gap="base">
                            <s-text variant="bodyMd" fontWeight="semibold">{tool.toolName}</s-text>
                            <s-badge tone={tool.success ? 'success' : 'critical'}>
                              {tool.success ? 'Success' : 'Failed'}
                            </s-badge>
                            <s-text variant="bodySm" tone="subdued">{tool.latencyMs}ms</s-text>
                          </s-inline>
                          <s-text variant="bodySm" tone="subdued">
                            Args: {JSON.stringify(tool.toolArgs).substring(0, 100)}...
                          </s-text>
                        </s-stack>
                      </div>
                    ))}
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
                debugData.recentEvents.slice(0, 20).map((event) => (
                  <div 
                    key={event.id}
                    style={{ 
                      padding: '8px 12px',
                      background: event.type === 'error' ? '#fef2f2' : '#f9fafb',
                      borderRadius: '4px',
                      borderLeft: `3px solid ${event.type === 'error' ? '#ef4444' : event.type === 'tool_call' ? '#f59e0b' : '#3b82f6'}`
                    }}
                  >
                    <s-inline gap="base">
                      <s-text>{getEventIcon(event.type)}</s-text>
                      <s-text variant="bodySm" fontWeight="medium">{event.type}</s-text>
                      <s-text variant="bodySm" tone="subdued">{formatTimestamp(event.timestamp)}</s-text>
                    </s-inline>
                    {event.type === 'tool_call' && (
                      <s-text variant="bodySm" tone="subdued">
                        {event.toolName} - {event.latencyMs}ms
                      </s-text>
                    )}
                    {event.type === 'token_usage' && (
                      <s-text variant="bodySm" tone="subdued">
                        +{event.inputTokens} in / +{event.outputTokens} out
                      </s-text>
                    )}
                    {event.type === 'mcp_connection' && (
                      <s-text variant="bodySm" tone="subdued">
                        {event.serverType}: {event.toolCount} tools ({event.latencyMs}ms)
                      </s-text>
                    )}
                  </div>
                ))
              )}
            </s-stack>
          )}
        </s-section>
      </s-inline>
    </s-page>
  );
}
