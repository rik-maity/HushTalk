
import { api } from "./client";

export async function fetchConversations() {
  const { data } = await api.get("/api/v1/conversations");
  return data;
}

export async function fetchUsers() {
  const { data } = await api.get("/api/v1/users");
  return data;
}

export async function createConversation(name) {
  const { data } = await api.post(
    "/api/v1/conversations",
    { name }
  );

  return data;
}

export async function addConversationMember(
  conversationId,
  userId
) {
  await api.post(
    `/api/v1/conversations/${conversationId}/members`,
    { userId: Number(userId) }
  );
}

export async function fetchMessageHistory(conversationId) {
  const { data } = await api.get(
    `/api/v1/conversations/${conversationId}/messages/cursor`,
    {
      params: { limit: 50 }
    }
  );

  return data.messages || [];
}

// --------------------
// Delivery / read receipts
// --------------------

export async function markMessageDelivered(
  conversationId,
  messageId
) {
  const { data } = await api.post(
    `/api/v1/conversations/${conversationId}/messages/${messageId}/delivered`
  );

  return data;
}

export async function markMessageRead(
  conversationId,
  messageId
) {
  const { data } = await api.post(
    `/api/v1/conversations/${conversationId}/messages/${messageId}/read`
  );

  return data;
}

export async function fetchMessageReceipts(
  conversationId,
  messageId
) {
  const { data } = await api.get(
    `/api/v1/conversations/${conversationId}/messages/${messageId}/receipts`
  );

  return data;
}

// --------------------
// Reactions
// --------------------

export async function fetchMessageReactions(
  conversationId,
  messageId
) {
  const { data } = await api.get(
    `/api/v1/conversations/${conversationId}/messages/${messageId}/reactions`
  );

  return data;
}

export async function addMessageReaction(
  conversationId,
  messageId,
  type
) {
  const { data } = await api.post(
    `/api/v1/conversations/${conversationId}/messages/${messageId}/reactions`,
    { type }
  );

  return data;
}

export async function removeMessageReaction(
  conversationId,
  messageId,
  type
) {
  await api.delete(
    `/api/v1/conversations/${conversationId}/messages/${messageId}/reactions`,
    {
      data: { type }
    }
  );
}

export async function fetchConversationMembers(conversationId) {
  const { data } = await api.get(
    `/api/v1/conversations/${conversationId}/members`
  );

  return data;
}
