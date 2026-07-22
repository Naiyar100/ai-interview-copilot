import logger from "../../config/logger.js";
import { buildCoachContents, buildCoachSystemInstruction } from "./promptBuilder.js";
import { extractCoachText, parseSseEvents } from "./responseParser.js";

const createError = (statusCode, message, code) => { const error = new Error(message); error.statusCode = statusCode; error.code = code; return error; };
const providerError = (status) => status === 429
  ? createError(429, "The career coach is busy. Please try again shortly.", "AI_RATE_LIMIT")
  : status >= 500 ? createError(503, "The career coach is temporarily unavailable.", "AI_UNAVAILABLE")
    : createError(502, "The career coach could not complete this response.", "AI_REQUEST_FAILED");

export const streamCoachResponse = async ({ messages, context, onChunk, signal }, { fetchImpl = globalThis.fetch } = {}) => {
  if (!process.env.GEMINI_API_KEY?.trim()) throw createError(503, "The AI service is not configured.", "MISSING_AI_KEY");
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
  const startedAt = performance.now();
  logger.info({ feature: "Career coach", model, event: "ai.request" }, "AI request started");
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: buildCoachSystemInstruction(context) }] }, contents: buildCoachContents(messages), generationConfig: { temperature: 0.55, maxOutputTokens: 4096 } }),
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw createError(503, "Unable to reach the career coach. Check your connection and try again.", "AI_NETWORK_ERROR");
  }
  logger.info({ feature: "Career coach", model, statusCode: response.status, durationMs: Math.round(performance.now() - startedAt), event: "ai.response" }, "AI stream opened");
  if (!response.ok) throw providerError(response.status);
  if (!response.body) throw createError(502, "The career coach returned an empty stream.", "EMPTY_AI_STREAM");
  const reader = response.body.getReader(); const decoder = new TextDecoder();
  let buffer = ""; let complete = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const parsed = parseSseEvents(buffer); buffer = parsed.remainder;
    for (const event of parsed.events) { const text = extractCoachText(event); if (text) { complete += text; onChunk(text); } }
    if (done) break;
  }
  if (buffer.trim()) {
    const data = buffer.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
    if (data && data !== "[DONE]") { const text = extractCoachText(JSON.parse(data)); if (text) { complete += text; onChunk(text); } }
  }
  if (!complete.trim()) throw createError(502, "The career coach returned an empty response.", "EMPTY_AI_RESPONSE");
  return complete.trim();
};
