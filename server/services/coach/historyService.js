import mongoose from "mongoose";
import CoachConversation from "../../models/CoachConversation.js";

const fail = (statusCode, message) => {
  const error = new Error(message); error.statusCode = statusCode; throw error;
};

export const cleanChatTitle = (value) => {
  if (typeof value !== "string") fail(400, "Chat title is required");
  const title = value.replace(/[<>$\0{}]/g, "").replace(/\s+/g, " ").trim();
  if (!title || title.length > 80) fail(400, "Chat title must be between 1 and 80 characters");
  return title;
};

export const titleFromMessage = (message) => {
  const cleaned = message.replace(/[`#*>_[\]]/g, "").replace(/\s+/g, " ").trim();
  return cleaned.length > 56 ? `${cleaned.slice(0, 53).trim()}...` : cleaned || "New career conversation";
};

export const getOwnedConversation = async (conversationId, userId) => {
  if (!mongoose.isValidObjectId(conversationId)) fail(400, "Invalid chat ID");
  const conversation = await CoachConversation.findById(conversationId);
  if (!conversation) fail(404, "Career coach chat not found");
  if (!conversation.user.equals(userId)) fail(403, "You do not have access to this chat");
  return conversation;
};

export const createConversation = (userId, title = "New career conversation") =>
  CoachConversation.create({ user: userId, title: cleanChatTitle(title), messages: [], lastMessageAt: new Date() });

export const listConversations = async (userId, search = "") => {
  const filter = { user: userId };
  const cleanedSearch = typeof search === "string" ? search.trim().slice(0, 80) : "";
  if (cleanedSearch) {
    const escaped = cleanedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [{ title: new RegExp(escaped, "i") }, { "messages.content": new RegExp(escaped, "i") }];
  }
  return CoachConversation.find(filter).select("title pinned messages lastMessageAt createdAt updatedAt")
    .sort({ pinned: -1, lastMessageAt: -1 }).limit(100).lean();
};

export const formatConversationSummary = (conversation) => ({
  id: conversation._id, title: conversation.title, pinned: conversation.pinned,
  messageCount: conversation.messages?.length || 0,
  preview: conversation.messages?.at(-1)?.content?.slice(0, 120) || "No messages yet",
  lastMessageAt: conversation.lastMessageAt, createdAt: conversation.createdAt, updatedAt: conversation.updatedAt,
});

export const formatConversation = (conversation) => ({
  ...formatConversationSummary(conversation),
  messages: (conversation.messages || []).map((message) => ({
    id: message._id, role: message.role, content: message.content,
    regenerated: message.regenerated, createdAt: message.createdAt,
  })),
});
