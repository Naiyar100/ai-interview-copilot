import { sendSuccess } from "../utils/apiResponse.js";
import { streamCoachResponse } from "../services/coach/coachService.js";
import { buildCoachContext } from "../services/coach/contextBuilder.js";
import { cleanChatTitle, createConversation, formatConversation, formatConversationSummary, getOwnedConversation, listConversations, titleFromMessage } from "../services/coach/historyService.js";

const fail = (statusCode, message) => { const error = new Error(message); error.statusCode = statusCode; throw error; };
const cleanMessage = (message) => {
  if (typeof message !== "string") fail(400, "Message is required");
  const cleaned = message.trim();
  if (!cleaned || cleaned.length > 4000) fail(400, "Message must be between 1 and 4000 characters");
  return cleaned;
};
const writeEvent = (res, event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

export const createCoachChat = async (req, res) => {
  const conversation = await createConversation(req.user._id, req.body?.title || "New career conversation");
  return sendSuccess(res, 201, "Career coach chat created", { chat: formatConversation(conversation) });
};
export const getCoachChats = async (req, res) => {
  if (typeof req.query.search === "string" && req.query.search.length > 80) fail(400, "Chat search cannot exceed 80 characters");
  const chats = await listConversations(req.user._id, req.query.search);
  return sendSuccess(res, 200, "Career coach chats fetched", { chats: chats.map(formatConversationSummary) });
};
export const getCoachChat = async (req, res) => sendSuccess(res, 200, "Career coach chat fetched", { chat: formatConversation(await getOwnedConversation(req.params.id, req.user._id)) });
export const updateCoachChat = async (req, res) => {
  const conversation = await getOwnedConversation(req.params.id, req.user._id);
  if (req.body?.title === undefined && req.body?.pinned === undefined) fail(400, "Provide a title or pinned value");
  if (req.body.title !== undefined) conversation.title = cleanChatTitle(req.body.title);
  if (req.body.pinned !== undefined) { if (typeof req.body.pinned !== "boolean") fail(400, "pinned must be true or false"); conversation.pinned = req.body.pinned; }
  await conversation.save();
  return sendSuccess(res, 200, "Career coach chat updated", { chat: formatConversationSummary(conversation) });
};
export const deleteCoachChat = async (req, res) => {
  const conversation = await getOwnedConversation(req.params.id, req.user._id);
  await conversation.deleteOne();
  return sendSuccess(res, 200, "Career coach chat deleted", { id: conversation._id });
};

export const streamCoachChat = async (req, res, next) => {
  const regenerate = req.body?.regenerate === true;
  try {
    const context = await buildCoachContext(req.user);
    const conversation = req.body?.chatId ? await getOwnedConversation(req.body.chatId, req.user._id) : await createConversation(req.user._id);
    if ((!regenerate && conversation.messages.length > 98) || conversation.messages.length >= 100) fail(409, "This chat is full. Start a new conversation to continue.");
    let userMessage;
    if (regenerate) {
      if (!req.body?.chatId || conversation.messages.length < 2 || conversation.messages.at(-1).role !== "assistant" || conversation.messages.at(-2).role !== "user") fail(400, "There is no assistant response to regenerate");
      conversation.messages.pop(); userMessage = conversation.messages.at(-1);
    } else {
      const content = cleanMessage(req.body?.message);
      if (!conversation.messages.length) conversation.title = titleFromMessage(content);
      conversation.messages.push({ role: "user", content }); userMessage = conversation.messages.at(-1);
    }
    res.status(200).set({ "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    res.flushHeaders();
    writeEvent(res, "meta", { chatId: conversation._id, title: conversation.title, userMessageId: userMessage._id, regenerated: regenerate });
    const controller = new AbortController();
    res.on("close", () => { if (!res.writableEnded) controller.abort(); });
    const assistantContent = await streamCoachResponse({ messages: conversation.messages, context, signal: controller.signal, onChunk: (text) => writeEvent(res, "chunk", { text }) });
    conversation.messages.push({ role: "assistant", content: assistantContent, regenerated: regenerate });
    conversation.lastMessageAt = new Date(); await conversation.save();
    writeEvent(res, "done", { chat: formatConversation(conversation), assistantMessageId: conversation.messages.at(-1)._id });
    return res.end();
  } catch (error) {
    if (!res.headersSent) return next(error);
    if (error.name !== "AbortError") writeEvent(res, "error", { message: error.message || "Career coach response failed" });
    return res.end();
  }
};
