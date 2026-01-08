/**
 * Debug Dashboard
 * Admin view for monitoring AI chat interactions, token usage, and MCP tool calls
 */
import { useLoaderData, useRevalidator } from "react-router";
import { authenticate } from "../shopify.server";
import { getDebugData, clearDebugData } from "../services/debug.server";
import AppConfig from "../services/config.server";
import { useEffect, useState } from "react";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  const debugData = getDebugData();
  return { 
    debugData,
    modelInfo: {
      name: AppConfig.api.defaultModel,
      maxTokens: AppConfig.api.maxTokens,
      promptType: AppConfig.api.defaultPromptType
    }
  };
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
  const { debugData, modelInfo } = useLoaderData();
  const revalidator = useRevalidator();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [expandedTools, setExpandedTools] = useState(new Set());
  const [expandedEvents, setExpandedEvents] = useState(new Set());
  const [expandedSteps, setExpandedSteps] = useState(new Set());
  const [showArchitecture, setShowArchitecture] = useState(true);

  const toggleStepExpanded = (stepId) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

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

  // Build sequence timeline from conversation
  const buildSequenceTimeline = (conv) => {
    if (!conv) return [];
    
    const timeline = [];
    let stepNum = 1;
    
    // MCP Connections
    conv.mcpConnections.forEach(mcp => {
      timeline.push({
        step: stepNum++,
        type: 'mcp_connect',
        actor: 'App',
        target: 'Shopify MCP',
        action: `Connect to ${mcp.serverType} MCP`,
        toolCount: mcp.toolCount,
        toolNames: mcp.toolNames || [],
        latency: mcp.latencyMs,
        timestamp: mcp.timestamp
      });
    });
    
    // Interleave messages and tool calls by timestamp
    const events = [
      ...conv.messages.map(m => ({ ...m, eventType: 'message' })),
      ...conv.toolCalls.map(t => ({ ...t, eventType: 'tool' }))
    ].sort((a, b) => a.timestamp - b.timestamp);
    
    events.forEach(event => {
      if (event.eventType === 'message') {
        // Clean up the content preview - add space after common patterns
        let cleanedPreview = event.contentPreview || '';
        // Fix common concatenation issues (e.g., "responsePerfect" -> "response Perfect")
        cleanedPreview = cleanedPreview
          .replace(/([a-z])([A-Z])/g, '$1 $2')  // camelCase to spaces
          .replace(/([.!?])([A-Z])/g, '$1 $2'); // Missing space after punctuation
        
        if (event.role === 'user') {
          timeline.push({
            step: stepNum++,
            type: 'user_message',
            actor: 'Customer',
            target: 'Claude LLM',
            action: 'Send message',
            detail: cleanedPreview,
            timestamp: event.timestamp
          });
        } else {
          timeline.push({
            step: stepNum++,
            type: 'llm_response',
            actor: 'Claude LLM',
            target: 'Customer',
            action: 'Generate response',
            detail: cleanedPreview,
            timestamp: event.timestamp
          });
        }
      } else if (event.eventType === 'tool') {
        // LLM decides to use tool
        timeline.push({
          step: stepNum++,
          type: 'llm_decision',
          actor: 'Claude LLM',
          target: 'Shopify MCP',
          action: `Invoke tool: ${event.toolName}`,
          toolName: event.toolName,
          toolArgs: event.toolArgs,  // Keep full args for expansion
          detail: JSON.stringify(event.toolArgs),
          timestamp: event.timestamp,
          expandable: true
        });
        // MCP executes and returns
        timeline.push({
          step: stepNum++,
          type: 'mcp_response',
          actor: 'Shopify MCP',
          target: 'Claude LLM',
          action: `Return ${event.success ? 'results' : 'error'}`,
          result: event.result,  // Keep full result for expansion
          detail: event.result?.substring(0, 100) + '...',
          latency: event.latencyMs,
          timestamp: event.timestamp,
          success: event.success,
          expandable: true
        });
      }
    });
    
    return timeline;
  };

  const getActorStyle = (actor) => {
    switch (actor) {
      case 'Customer': return { bg: '#dbeafe', border: '#3b82f6', icon: '👤' };
      case 'Claude LLM': return { bg: '#fef3c7', border: '#f59e0b', icon: '🧠' };
      case 'Shopify MCP': return { bg: '#d1fae5', border: '#10b981', icon: '🔌' };
      case 'App': return { bg: '#e0e7ff', border: '#6366f1', icon: '⚙️' };
      default: return { bg: '#f3f4f6', border: '#9ca3af', icon: '📦' };
    }
  };

  return (
    <s-page>
      <ui-title-bar title="🔍 Debug Dashboard - AI Chat Monitor" />
      
      {/* Architecture Overview Toggle */}
      <s-section>
        <s-inline gap="base">
          <s-button 
            variant={showArchitecture ? "primary" : "tertiary"}
            onClick={() => setShowArchitecture(!showArchitecture)}
          >
            {showArchitecture ? '🏗️ Hide Architecture' : '🏗️ Show Architecture'}
          </s-button>
        </s-inline>
      </s-section>

      {/* Architecture & Model Info */}
      {showArchitecture && (
        <s-section>
          <s-stack gap="loose">
            {/* Architecture Diagram */}
            <s-card>
              <s-stack gap="base">
                <s-text variant="headingMd">🏗️ System Architecture: LLM ↔ MCP Flow</s-text>
                
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '20px',
                  background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                  borderRadius: '12px',
                  gap: '8px',
                  flexWrap: 'wrap'
                }}>
                  {/* Customer */}
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '16px 24px', 
                    background: '#dbeafe', 
                    borderRadius: '12px',
                    border: '2px solid #3b82f6',
                    minWidth: '120px'
                  }}>
                    <div style={{ fontSize: '32px' }}>👤</div>
                    <s-text variant="bodyMd" fontWeight="bold">Customer</s-text>
                    <s-text variant="bodySm" tone="subdued">Asks questions</s-text>
                  </div>
                  
                  <div style={{ fontSize: '24px', color: '#64748b' }}>→</div>
                  
                  {/* Claude LLM */}
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '16px 24px', 
                    background: '#fef3c7', 
                    borderRadius: '12px',
                    border: '2px solid #f59e0b',
                    minWidth: '140px'
                  }}>
                    <div style={{ fontSize: '32px' }}>🧠</div>
                    <s-text variant="bodyMd" fontWeight="bold">Claude LLM</s-text>
                    <s-text variant="bodySm" tone="subdued">Understands & reasons</s-text>
                  </div>
                  
                  <div style={{ fontSize: '24px', color: '#64748b' }}>⇄</div>
                  
                  {/* MCP */}
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '16px 24px', 
                    background: '#d1fae5', 
                    borderRadius: '12px',
                    border: '2px solid #10b981',
                    minWidth: '140px'
                  }}>
                    <div style={{ fontSize: '32px' }}>🔌</div>
                    <s-text variant="bodyMd" fontWeight="bold">Storefront MCP</s-text>
                    <s-text variant="bodySm" tone="subdued">Executes Shopify API</s-text>
                  </div>
                  
                  <div style={{ fontSize: '24px', color: '#64748b' }}>→</div>
                  
                  {/* Shopify */}
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '16px 24px', 
                    background: '#fce7f3', 
                    borderRadius: '12px',
                    border: '2px solid #ec4899',
                    minWidth: '120px'
                  }}>
                    <div style={{ fontSize: '32px' }}>🛍️</div>
                    <s-text variant="bodyMd" fontWeight="bold">Shopify Store</s-text>
                    <s-text variant="bodySm" tone="subdued">Products, Cart, etc.</s-text>
                  </div>
                </div>
              </s-stack>
            </s-card>

            {/* Who Does What */}
            <s-inline gap="base" blockAlign="start">
              {/* LLM Card */}
              <s-card style={{ flex: 1 }}>
                <s-stack gap="tight">
                  <s-inline gap="tight">
                    <span style={{ fontSize: '24px' }}>🧠</span>
                    <s-text variant="headingMd">Claude LLM</s-text>
                  </s-inline>
                  <s-badge tone="warning">{modelInfo.name}</s-badge>
                  <s-text variant="bodySm" tone="subdued">Max {modelInfo.maxTokens} tokens/response</s-text>
                  
                  <div style={{ marginTop: '8px', padding: '12px', background: '#fffbeb', borderRadius: '8px' }}>
                    <s-text variant="bodySm" fontWeight="semibold">What Claude does:</s-text>
                    <ul style={{ margin: '8px 0 0 16px', fontSize: '13px', color: '#78716c' }}>
                      <li>✅ Understands natural language</li>
                      <li>✅ Reasons about customer intent</li>
                      <li>✅ Decides WHICH tool to use</li>
                      <li>✅ Crafts the tool arguments</li>
                      <li>✅ Interprets results for customer</li>
                      <li>✅ Generates conversational response</li>
                    </ul>
                  </div>
                  
                  <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '8px' }}>
                    <s-text variant="bodySm" fontWeight="semibold">What Claude does NOT do:</s-text>
                    <ul style={{ margin: '8px 0 0 16px', fontSize: '13px', color: '#78716c' }}>
                      <li>❌ Access store data directly</li>
                      <li>❌ Execute API calls</li>
                      <li>❌ Modify cart/checkout</li>
                    </ul>
                  </div>
                </s-stack>
              </s-card>

              {/* MCP Card */}
              <s-card style={{ flex: 1 }}>
                <s-stack gap="tight">
                  <s-inline gap="tight">
                    <span style={{ fontSize: '24px' }}>🔌</span>
                    <s-text variant="headingMd">Shopify Storefront MCP</s-text>
                  </s-inline>
                  <s-badge tone="success">Model Context Protocol</s-badge>
                  <s-text variant="bodySm" tone="subdued">Secure API bridge</s-text>
                  
                  <div style={{ marginTop: '8px', padding: '12px', background: '#ecfdf5', borderRadius: '8px' }}>
                    <s-text variant="bodySm" fontWeight="semibold">What MCP does:</s-text>
                    <ul style={{ margin: '8px 0 0 16px', fontSize: '13px', color: '#78716c' }}>
                      <li>✅ Provides available tools to LLM</li>
                      <li>✅ Executes Shopify API calls</li>
                      <li>✅ Searches product catalog</li>
                      <li>✅ Manages shopping cart</li>
                      <li>✅ Returns structured data</li>
                      <li>✅ Handles authentication</li>
                    </ul>
                  </div>
                  
                  <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac' }}>
                    <s-text variant="bodySm" fontWeight="semibold">Available Tools:</s-text>
                    <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      <s-badge>search_shop_catalog</s-badge>
                      <s-badge>get_product_details</s-badge>
                      <s-badge>update_cart</s-badge>
                      <s-badge>get_cart</s-badge>
                      <s-badge>get_shop_info</s-badge>
                    </div>
                  </div>
                </s-stack>
              </s-card>
            </s-inline>
          </s-stack>
        </s-section>
      )}

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
              
              {/* Sequence Timeline */}
              <s-card>
                <s-stack gap="tight">
                  <s-text variant="headingSm">📋 Step-by-Step Sequence</s-text>
                  <s-text variant="bodySm" tone="subdued">Exact order of operations in this conversation</s-text>
                  
                  <div style={{ marginTop: '12px' }}>
                    {buildSequenceTimeline(selectedConversation).map((step, idx) => {
                      const actorStyle = getActorStyle(step.actor);
                      const targetStyle = getActorStyle(step.target);
                      const stepId = `step-${idx}`;
                      const isExpanded = expandedSteps.has(stepId);
                      
                      return (
                        <div 
                          key={idx}
                          style={{ 
                            display: 'flex',
                            alignItems: 'flex-start',
                            marginBottom: '8px',
                            padding: '10px',
                            background: actorStyle.bg,
                            borderRadius: '8px',
                            borderLeft: `4px solid ${actorStyle.border}`,
                            cursor: step.expandable ? 'pointer' : 'default'
                          }}
                          onClick={() => step.expandable && toggleStepExpanded(stepId)}
                        >
                          {/* Step Number */}
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: actorStyle.border,
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            marginRight: '12px',
                            flexShrink: 0
                          }}>
                            {step.step}
                          </div>
                          
                          {/* Content */}
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span>{actorStyle.icon}</span>
                              <s-text variant="bodySm" fontWeight="bold">{step.actor}</s-text>
                              <span style={{ color: '#9ca3af' }}>→</span>
                              <span>{targetStyle.icon}</span>
                              <s-text variant="bodySm" fontWeight="bold">{step.target}</s-text>
                              {step.latency && (
                                <s-badge tone="info">⏱️ {step.latency}ms</s-badge>
                              )}
                              {step.expandable && (
                                <s-text variant="bodySm" tone="subdued" style={{ marginLeft: 'auto' }}>
                                  {isExpanded ? '▼ Collapse' : '▶ Expand'}
                                </s-text>
                              )}
                            </div>
                            <s-text variant="bodySm" fontWeight="medium" style={{ fontStyle: 'italic' }}>{step.action}</s-text>
                            
                            {/* MCP Connection - show tool count and names */}
                            {step.type === 'mcp_connect' && (
                              <div style={{ marginTop: '6px' }}>
                                <s-badge tone="success">{step.toolCount} tools available</s-badge>
                                {step.toolNames && step.toolNames.length > 0 && (
                                  <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {step.toolNames.map((name, i) => (
                                      <s-badge key={i} tone="info" style={{ fontSize: '10px' }}>{name}</s-badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* LLM Decision (tool invocation) - show args */}
                            {step.type === 'llm_decision' && (
                              <div style={{ marginTop: '6px' }}>
                                {!isExpanded && step.detail && (
                                  <s-text variant="bodySm" tone="subdued" style={{ 
                                    display: 'block',
                                    fontFamily: 'Monaco, Consolas, monospace',
                                    fontSize: '11px',
                                    wordBreak: 'break-word'
                                  }}>
                                    {step.detail.length > 100 ? step.detail.substring(0, 100) + '...' : step.detail}
                                  </s-text>
                                )}
                                {isExpanded && (
                                  <div style={{ marginTop: '8px' }}>
                                    <s-text variant="bodySm" fontWeight="semibold" tone="subdued">📥 Full Arguments:</s-text>
                                    <pre style={{ 
                                      background: '#1e293b', 
                                      color: '#e2e8f0', 
                                      padding: '12px', 
                                      borderRadius: '6px', 
                                      fontSize: '11px',
                                      overflow: 'auto',
                                      maxHeight: '250px',
                                      marginTop: '4px',
                                      fontFamily: 'Monaco, Consolas, monospace',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word'
                                    }}>
                                      {formatJson(step.toolArgs)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* MCP Response - show result */}
                            {step.type === 'mcp_response' && (
                              <div style={{ marginTop: '6px' }}>
                                <s-badge tone={step.success !== false ? 'success' : 'critical'}>
                                  {step.success !== false ? '✓ Success' : '✗ Error'}
                                </s-badge>
                                {!isExpanded && step.detail && (
                                  <s-text variant="bodySm" tone="subdued" style={{ 
                                    display: 'block',
                                    marginTop: '4px',
                                    fontFamily: 'Monaco, Consolas, monospace',
                                    fontSize: '11px',
                                    wordBreak: 'break-word'
                                  }}>
                                    {step.detail}
                                  </s-text>
                                )}
                                {isExpanded && step.result && (
                                  <div style={{ marginTop: '8px' }}>
                                    <s-text variant="bodySm" fontWeight="semibold" tone="subdued">📤 Full Result:</s-text>
                                    <pre style={{ 
                                      background: '#1e293b', 
                                      color: '#e2e8f0', 
                                      padding: '12px', 
                                      borderRadius: '6px', 
                                      fontSize: '11px',
                                      overflow: 'auto',
                                      maxHeight: '300px',
                                      marginTop: '4px',
                                      fontFamily: 'Monaco, Consolas, monospace',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word'
                                    }}>
                                      {step.result}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* User/Assistant messages - show detail */}
                            {(step.type === 'user_message' || step.type === 'llm_response') && step.detail && (
                              <s-text variant="bodySm" tone="subdued" style={{ 
                                display: 'block',
                                marginTop: '4px',
                                wordBreak: 'break-word'
                              }}>
                                {step.detail}
                              </s-text>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </s-stack>
              </s-card>
              
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
