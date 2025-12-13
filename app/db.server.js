import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient();

export default prisma;

/**
 * Store a code verifier for PKCE authentication
 * @param {string} state - The state parameter used in OAuth flow
 * @param {string} verifier - The code verifier to store
 * @returns {Promise<Object>} - The saved code verifier object
 */
export async function storeCodeVerifier(state, verifier) {
  // Calculate expiration date (10 minutes from now)
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  try {
    return await prisma.codeVerifier.create({
      data: {
        id: `cv_${Date.now()}`,
        state,
        verifier,
        expiresAt
      }
    });
  } catch (error) {
    console.error('Error storing code verifier:', error);
    throw error;
  }
}

/**
 * Get a code verifier by state parameter
 * @param {string} state - The state parameter used in OAuth flow
 * @returns {Promise<Object|null>} - The code verifier object or null if not found
 */
export async function getCodeVerifier(state) {
  try {
    const verifier = await prisma.codeVerifier.findFirst({
      where: {
        state,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (verifier) {
      // Delete it after retrieval to prevent reuse
      await prisma.codeVerifier.delete({
        where: {
          id: verifier.id
        }
      });
    }

    return verifier;
  } catch (error) {
    console.error('Error retrieving code verifier:', error);
    return null;
  }
}

/**
 * Store a customer access token in the database
 * @param {string} conversationId - The conversation ID to associate with the token
 * @param {string} accessToken - The access token to store
 * @param {Date} expiresAt - When the token expires
 * @returns {Promise<Object>} - The saved customer token
 */
export async function storeCustomerToken(conversationId, accessToken, expiresAt) {
  try {
    // Check if a token already exists for this conversation
    const existingToken = await prisma.customerToken.findFirst({
      where: { conversationId }
    });

    if (existingToken) {
      // Update existing token
      return await prisma.customerToken.update({
        where: { id: existingToken.id },
        data: {
          accessToken,
          expiresAt,
          updatedAt: new Date()
        }
      });
    }

    // Create a new token record
    return await prisma.customerToken.create({
      data: {
        id: `ct_${Date.now()}`,
        conversationId,
        accessToken,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error storing customer token:', error);
    throw error;
  }
}

/**
 * Get a customer access token by conversation ID
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Object|null>} - The customer token or null if not found/expired
 */
export async function getCustomerToken(conversationId) {
  try {
    const token = await prisma.customerToken.findFirst({
      where: {
        conversationId,
        expiresAt: {
          gt: new Date() // Only return non-expired tokens
        }
      }
    });

    return token;
  } catch (error) {
    console.error('Error retrieving customer token:', error);
    return null;
  }
}

/**
 * Create or update a conversation in the database
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Object>} - The created or updated conversation
 */
export async function createOrUpdateConversation(conversationId) {
  try {
    const existingConversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (existingConversation) {
      return await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          updatedAt: new Date()
        }
      });
    }

    return await prisma.conversation.create({
      data: {
        id: conversationId
      }
    });
  } catch (error) {
    console.error('Error creating/updating conversation:', error);
    throw error;
  }
}

/**
 * Save a message to the database
 * @param {string} conversationId - The conversation ID
 * @param {string} role - The message role (user or assistant)
 * @param {string} content - The message content
 * @returns {Promise<Object>} - The saved message
 */
export async function saveMessage(conversationId, role, content) {
  try {
    // Ensure the conversation exists
    await createOrUpdateConversation(conversationId);

    // Create the message
    return await prisma.message.create({
      data: {
        conversationId,
        role,
        content
      }
    });
  } catch (error) {
    console.error('Error saving message:', error);
    throw error;
  }
}

/**
 * Get conversation history
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Array>} - Array of messages in the conversation
 */
export async function getConversationHistory(conversationId) {
  try {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' }
    });

    return messages;
  } catch (error) {
    console.error('Error retrieving conversation history:', error);
    return [];
  }
}

/**
 * Store customer account URLs for a conversation
 * @param {string} conversationId - The conversation ID
 * @param {string} mcpApiUrl - The customer account MCP URL
 * @param {string} authorizationUrl - The customer account authorization URL
 * @param {string} tokenUrl - The customer account token URL
 * @returns {Promise<Object>} - The saved urls object
 */
export async function storeCustomerAccountUrls({conversationId, mcpApiUrl, authorizationUrl, tokenUrl}) {
  try {
    return await prisma.customerAccountUrls.upsert({
      where: { conversationId },
      create: {
        conversationId,
        mcpApiUrl,
        authorizationUrl,
        tokenUrl,
        updatedAt: new Date(),
      },
      update: {
        mcpApiUrl,
        authorizationUrl,
        tokenUrl,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error storing customer account URLs:', error);
    throw error;
  }
}

/**
 * Get customer account URLs for a conversation
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Object|null>} - The customer account URLs or null if not found
 */
export async function getCustomerAccountUrls(conversationId) {
  try {
    return await prisma.customerAccountUrls.findUnique({
      where: { conversationId }
    });
  } catch (error) {
    console.error('Error retrieving customer account URLs:', error);
    return null;
  }
}

// ============================================
// ChatUser 用户管理相关函数
// ============================================

/**
 * 创建新的聊天用户
 * @param {string} shopId - 商店ID
 * @param {string} username - 用户名
 * @param {string} passwordHash - 密码哈希
 * @returns {Promise<Object>} - 创建的用户
 */
export async function createChatUser(shopId, username, passwordHash) {
  try {
    return await prisma.chatUser.create({
      data: {
        shopId,
        username,
        passwordHash
      }
    });
  } catch (error) {
    console.error('Error creating chat user:', error);
    throw error;
  }
}

/**
 * 根据商店ID和用户名查找用户
 * @param {string} shopId - 商店ID
 * @param {string} username - 用户名
 * @returns {Promise<Object|null>} - 用户对象或null
 */
export async function getChatUserByUsername(shopId, username) {
  try {
    return await prisma.chatUser.findUnique({
      where: {
        shopId_username: { shopId, username }
      }
    });
  } catch (error) {
    console.error('Error getting chat user:', error);
    return null;
  }
}

/**
 * 根据ID查找用户
 * @param {string} userId - 用户ID
 * @returns {Promise<Object|null>} - 用户对象或null
 */
export async function getChatUserById(userId) {
  try {
    return await prisma.chatUser.findUnique({
      where: { id: userId }
    });
  } catch (error) {
    console.error('Error getting chat user by id:', error);
    return null;
  }
}

/**
 * 更新用户的当前提示词
 * @param {string} userId - 用户ID
 * @param {string} prompt - 新的提示词
 * @returns {Promise<Object>} - 更新后的用户对象
 */
export async function updateUserPrompt(userId, prompt) {
  try {
    // 获取当前用户以检查是否需要保存历史
    const user = await prisma.chatUser.findUnique({
      where: { id: userId }
    });

    // 如果用户有旧的提示词，保存到历史记录
    if (user && user.currentPrompt) {
      // 获取当前最大版本号
      const lastHistory = await prisma.promptHistory.findFirst({
        where: { userId },
        orderBy: { version: 'desc' }
      });
      const newVersion = (lastHistory?.version || 0) + 1;

      // 保存旧提示词到历史
      await prisma.promptHistory.create({
        data: {
          userId,
          content: user.currentPrompt,
          version: newVersion
        }
      });
    }

    // 更新当前提示词
    return await prisma.chatUser.update({
      where: { id: userId },
      data: {
        currentPrompt: prompt,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error updating user prompt:', error);
    throw error;
  }
}

/**
 * 获取用户的提示词历史记录
 * @param {string} userId - 用户ID
 * @returns {Promise<Array>} - 提示词历史列表
 */
export async function getPromptHistory(userId) {
  try {
    return await prisma.promptHistory.findMany({
      where: { userId },
      orderBy: { version: 'desc' }
    });
  } catch (error) {
    console.error('Error getting prompt history:', error);
    return [];
  }
}

/**
 * 根据ID获取某个历史提示词
 * @param {string} historyId - 历史记录ID
 * @returns {Promise<Object|null>} - 历史记录或null
 */
export async function getPromptHistoryById(historyId) {
  try {
    return await prisma.promptHistory.findUnique({
      where: { id: historyId }
    });
  } catch (error) {
    console.error('Error getting prompt history by id:', error);
    return null;
  }
}

/**
 * 恢复用户提示词到某个历史版本
 * @param {string} userId - 用户ID
 * @param {string} historyId - 历史记录ID
 * @returns {Promise<Object>} - 更新后的用户对象
 */
export async function restorePromptFromHistory(userId, historyId) {
  try {
    const history = await prisma.promptHistory.findUnique({
      where: { id: historyId }
    });

    if (!history || history.userId !== userId) {
      throw new Error('History not found or unauthorized');
    }

    // 使用 updateUserPrompt 来保存当前提示词到历史并更新
    return await updateUserPrompt(userId, history.content);
  } catch (error) {
    console.error('Error restoring prompt from history:', error);
    throw error;
  }
}
