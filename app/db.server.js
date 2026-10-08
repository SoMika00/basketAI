import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Saves a message to the database for a given conversation.
 * Creates the conversation if it does not exist.
 *
 * @param {string} conversationId - The conversation ID
 * @param {string} role - The role of the message ("user" or "assistant")
 * @param {string} content - The message content
 * @returns {Promise<Object>} The saved message
 */
export async function saveMessage(conversationId, role, content) {
  return prisma.message.create({
    data: {
      conversationId,
      role,
      content,
    },
  });
}

/**
 * Retrieves the full message history for a conversation.
 *
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Array>} Array of messages ordered by creation time
 */
export async function getConversationHistory(conversationId) {
  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Retrieves the customer token for a conversation.
 *
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Object|null>} The customer token or null
 */
export async function getCustomerToken(conversationId) {
  return prisma.customerToken.findFirst({
    where: { conversationId },
  });
}

/**
 * Stores a customer token for a conversation.
 *
 * @param {Object} params - Token parameters
 * @param {string} params.conversationId - The conversation ID
 * @param {string} params.accessToken - The access token
 * @param {string} [params.refreshToken] - The refresh token
 * @param {Date} params.expiresAt - Token expiry
 * @returns {Promise<Object>} The stored token
 */
export async function storeCustomerToken({
  conversationId,
  accessToken,
  refreshToken,
  expiresAt,
}) {
  return prisma.customerToken.create({
    data: {
      id: crypto.randomUUID(),
      conversationId,
      accessToken,
      refreshToken,
      expiresAt,
    },
  });
}

/**
 * Stores customer account URLs for a conversation.
 *
 * @param {Object} params - URL parameters
 * @param {string} params.conversationId - The conversation ID
 * @param {string} [params.mcpApiUrl] - The MCP API URL
 * @param {string} [params.authorizationUrl] - The authorization URL
 * @param {string} [params.tokenUrl] - The token URL
 * @returns {Promise<Object>} The stored URLs
 */
export async function storeCustomerAccountUrls({
  conversationId,
  mcpApiUrl,
  authorizationUrl,
  tokenUrl,
}) {
  return prisma.customerAccountUrls.upsert({
    where: { conversationId },
    update: { mcpApiUrl, authorizationUrl, tokenUrl },
    create: { conversationId, mcpApiUrl, authorizationUrl, tokenUrl },
  });
}

/**
 * Retrieves customer account URLs for a conversation.
 *
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Object|null>} The stored URLs or null
 */
export async function getCustomerAccountUrls(conversationId) {
  return prisma.customerAccountUrls.findUnique({
    where: { conversationId },
  });
}

/**
 * Deletes a conversation and all associated data.
 * Removes the Conversation row (cascading to Message rows) and any
 * CustomerToken and CustomerAccountUrls rows for the conversation.
 *
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<{deleted: boolean, messages_deleted: number}>} Result summary
 */
export async function deleteConversation(conversationId) {
  // Count messages before deletion for the response payload.
  const messages = await prisma.message.findMany({
    where: { conversationId },
    select: { id: true },
  });
  const messagesDeleted = messages.length;

  // Delete associated auth state (no cascade relation exists for these).
  await prisma.customerToken.deleteMany({ where: { conversationId } });
  await prisma.customerAccountUrls.deleteMany({ where: { conversationId } });

  // Delete the conversation; Message rows cascade via onDelete: Cascade.
  const result = await prisma.conversation.deleteMany({
    where: { id: conversationId },
  });

  return {
    deleted: result.count > 0,
    messages_deleted: messagesDeleted,
  };
}

export default prisma;
