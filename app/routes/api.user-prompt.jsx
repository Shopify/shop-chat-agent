/**
 * User Prompt Management API
 * 用户提示词管理接口（含历史版本）
 */
import { 
  getChatUserById, 
  updateUserPrompt, 
  getPromptHistory, 
  restorePromptFromHistory 
} from "../db.server";

/**
 * 解析认证 token
 */
function parseToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    if (payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * 从请求中提取并验证用户
 */
async function authenticateRequest(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  const payload = parseToken(token);

  if (!payload) {
    return null;
  }

  const user = await getChatUserById(payload.userId);
  if (!user || !user.isActive) {
    return null;
  }

  return user;
}

/**
 * GET 请求 - 获取当前提示词或历史记录
 */
export async function loader({ request }) {
  // Handle OPTIONS requests (CORS preflight)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request)
    });
  }

  // 验证用户
  const user = await authenticateRequest(request);
  if (!user) {
    return jsonResponse({ error: "未授权" }, 401, request);
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action === "history") {
    // 获取提示词历史记录
    const history = await getPromptHistory(user.id);
    return jsonResponse({
      history: history.map(h => ({
        id: h.id,
        version: h.version,
        content: h.content,
        createdAt: h.createdAt.toISOString()
      }))
    }, 200, request);
  }

  // 默认返回当前提示词
  return jsonResponse({
    currentPrompt: user.currentPrompt || "",
    userId: user.id
  }, 200, request);
}

/**
 * POST 请求 - 更新提示词或恢复历史版本
 */
export async function action({ request }) {
  // Handle OPTIONS requests (CORS preflight)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request)
    });
  }

  // 验证用户
  const user = await authenticateRequest(request);
  if (!user) {
    return jsonResponse({ error: "未授权" }, 401, request);
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === "update") {
      // 更新提示词
      const { prompt } = body;
      
      if (typeof prompt !== 'string') {
        return jsonResponse({ error: "提示词必须是字符串" }, 400, request);
      }

      const updatedUser = await updateUserPrompt(user.id, prompt);
      
      return jsonResponse({
        success: true,
        currentPrompt: updatedUser.currentPrompt
      }, 200, request);
    }

    if (action === "restore") {
      // 恢复历史版本
      const { historyId } = body;
      
      if (!historyId) {
        return jsonResponse({ error: "缺少历史记录ID" }, 400, request);
      }

      const updatedUser = await restorePromptFromHistory(user.id, historyId);
      
      return jsonResponse({
        success: true,
        currentPrompt: updatedUser.currentPrompt
      }, 200, request);
    }

    return jsonResponse({ error: "无效的操作" }, 400, request);
  } catch (error) {
    console.error("Prompt API error:", error);
    return jsonResponse({ error: "服务器错误" }, 500, request);
  }
}

/**
 * 返回 JSON 响应
 */
function jsonResponse(data, status, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(request)
    }
  });
}

/**
 * CORS 头信息
 */
function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400"
  };
}
