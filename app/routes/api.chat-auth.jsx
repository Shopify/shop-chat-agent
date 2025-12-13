/**
 * Chat User Authentication API
 * 用户注册/登录接口
 */
import crypto from 'crypto';
import { createChatUser, getChatUserByUsername, getChatUserById } from "../db.server";

/**
 * 简单的密码哈希函数
 */
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * 生成简单的认证 token
 */
function generateToken(userId) {
  const payload = {
    userId,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7天过期
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * 解析认证 token
 */
function parseToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    if (payload.exp < Date.now()) {
      return null; // Token 已过期
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * GET 请求 - 检查登录状态
 */
export async function loader({ request }) {
  // Handle OPTIONS requests (CORS preflight)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request)
    });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action === "check") {
    // 从 header 中获取 token
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse({ authenticated: false }, 200, request);
    }

    const token = authHeader.substring(7);
    const payload = parseToken(token);

    if (!payload) {
      return jsonResponse({ authenticated: false }, 200, request);
    }

    const user = await getChatUserById(payload.userId);
    if (!user || !user.isActive) {
      return jsonResponse({ authenticated: false }, 200, request);
    }

    return jsonResponse({
      authenticated: true,
      userId: user.id,
      username: user.username,
      currentPrompt: user.currentPrompt
    }, 200, request);
  }

  return jsonResponse({ error: "Invalid action" }, 400, request);
}

/**
 * POST 请求 - 注册/登录
 */
export async function action({ request }) {
  // Handle OPTIONS requests (CORS preflight)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request)
    });
  }

  try {
    const body = await request.json();
    const { action, username, password, shopId } = body;

    // 验证必要参数
    if (!username || !password || !shopId) {
      return jsonResponse({ error: "缺少必要参数" }, 400, request);
    }

    // 用户名验证
    if (username.length < 2 || username.length > 50) {
      return jsonResponse({ error: "用户名长度应为2-50个字符" }, 400, request);
    }

    // 密码验证
    if (password.length < 4) {
      return jsonResponse({ error: "密码长度至少4个字符" }, 400, request);
    }

    if (action === "register") {
      return handleRegister(shopId, username, password, request);
    } else if (action === "login") {
      return handleLogin(shopId, username, password, request);
    } else {
      return jsonResponse({ error: "无效的操作" }, 400, request);
    }
  } catch (error) {
    console.error("Auth error:", error);
    return jsonResponse({ error: "服务器错误" }, 500, request);
  }
}

/**
 * 处理用户注册
 */
async function handleRegister(shopId, username, password, request) {
  // 检查用户是否已存在
  const existingUser = await getChatUserByUsername(shopId, username);
  if (existingUser) {
    return jsonResponse({ error: "用户名已存在" }, 409, request);
  }

  // 创建新用户
  const passwordHash = hashPassword(password);
  const user = await createChatUser(shopId, username, passwordHash);

  // 生成 token
  const token = generateToken(user.id);

  return jsonResponse({
    success: true,
    userId: user.id,
    username: user.username,
    token
  }, 201, request);
}

/**
 * 处理用户登录
 */
async function handleLogin(shopId, username, password, request) {
  // 查找用户
  const user = await getChatUserByUsername(shopId, username);
  if (!user) {
    return jsonResponse({ error: "用户名或密码错误" }, 401, request);
  }

  // 验证密码
  const passwordHash = hashPassword(password);
  if (user.passwordHash !== passwordHash) {
    return jsonResponse({ error: "用户名或密码错误" }, 401, request);
  }

  // 检查用户是否激活
  if (!user.isActive) {
    return jsonResponse({ error: "账户已被禁用" }, 403, request);
  }

  // 生成 token
  const token = generateToken(user.id);

  return jsonResponse({
    success: true,
    userId: user.id,
    username: user.username,
    currentPrompt: user.currentPrompt,
    token
  }, 200, request);
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
