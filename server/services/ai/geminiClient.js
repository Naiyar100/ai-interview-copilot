import logger from "../../config/logger.js";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const DEFAULT_MODEL = "gemini-3.5-flash";
const DEFAULT_FALLBACK_MODEL = "gemini-3.1-flash-lite";
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_ATTEMPTS = 2;

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const createServiceError = (statusCode, message, code, retryable = false) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.retryable = retryable;
  return error;
};

const findText = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = findText(item);
      if (text) return text;
    }
    return "";
  }
  if (typeof value === "object") {
    for (const key of ["output_text", "outputText", "text"]) {
      if (typeof value[key] === "string" && value[key].trim()) return value[key];
    }
    for (const key of ["outputs", "output", "steps", "content", "parts"]) {
      const text = findText(value[key]);
      if (text) return text;
    }
  }
  return "";
};

const mapProviderError = (status, feature) => {
  if (status === 429) {
    return createServiceError(429, `${feature} is busy. Please try again shortly.`, "AI_RATE_LIMIT", true);
  }
  if (status >= 500) {
    return createServiceError(503, "The AI service is temporarily unavailable. Please try again.", "AI_UNAVAILABLE", true);
  }
  return createServiceError(502, `The AI service could not complete ${feature.toLowerCase()}.`, "AI_REQUEST_FAILED");
};

const requestStructuredResponse = async ({
  prompt,
  responseSchema,
  parseResponse,
  feature,
  fetchImpl,
  timeoutMs,
  model,
}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const startedAt = performance.now();
    logger.info({ feature, model, event: "ai.request" }, "AI request started");
    const response = await fetchImpl(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        model,
        input: prompt,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: responseSchema,
        },
        store: false,
      }),
      signal: controller.signal,
    });

    logger.info({
      feature,
      model,
      statusCode: response.status,
      durationMs: Math.round(performance.now() - startedAt),
      event: "ai.response",
    }, "AI request completed");
    if (!response.ok) throw mapProviderError(response.status, feature);
    const payload = await response.json();
    return parseResponse(findText(payload));
  } catch (error) {
    if (error.name === "AbortError") {
      throw createServiceError(504, `${feature} timed out. Please try again.`, "AI_TIMEOUT", true);
    }
    if (error.code === "INVALID_AI_RESPONSE" || error.statusCode) throw error;
    throw createServiceError(503, "Unable to reach the AI service. Please check your connection and try again.", "AI_NETWORK_ERROR", true);
  } finally {
    clearTimeout(timeout);
  }
};

export const requestStructuredGemini = async (
  { prompt, responseSchema, parseResponse, feature = "AI request" },
  {
    fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxAttempts = DEFAULT_ATTEMPTS,
  } = {},
) => {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw createServiceError(503, "The AI service is not configured.", "MISSING_AI_KEY");
  }

  let lastError;
  const primaryModel = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL?.trim() || DEFAULT_FALLBACK_MODEL;
  const models = [...new Set([primaryModel, fallbackModel])];
  let modelIndex = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await requestStructuredResponse({
        prompt,
        responseSchema,
        parseResponse,
        feature,
        fetchImpl,
        timeoutMs,
        model: models[modelIndex],
      });
    } catch (error) {
      lastError = error;
      if (!error.retryable || attempt === maxAttempts) break;
      if (["AI_RATE_LIMIT", "AI_UNAVAILABLE"].includes(error.code)) {
        modelIndex = Math.min(modelIndex + 1, models.length - 1);
      }
      const backoff = Math.min(1000 * 2 ** (attempt - 1), 8000);
      const jitter = Math.floor(Math.random() * 300);
      await wait(backoff + jitter);
    }
  }

  if (lastError?.code === "AI_RATE_LIMIT") {
    const error = createServiceError(
      429,
      "Gemini rate limit reached. Wait briefly and try again, or check your Google AI Studio quota.",
      "AI_RATE_LIMIT",
    );
    error.retryAfterSeconds = 30;
    throw error;
  }
  if (lastError?.code === "INVALID_AI_RESPONSE") {
    throw createServiceError(502, `${feature} returned an unusable response. Please try again.`, "INVALID_AI_RESPONSE");
  }
  throw lastError;
};
