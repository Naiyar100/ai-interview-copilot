const invalid = (message) => { const error = new Error(message); error.code = "INVALID_AI_RESPONSE"; error.retryable = true; throw error; };
const clean = (value, field, maximum = 1000) => {
  if (typeof value !== "string" || !value.trim()) invalid(`Resume suggestion is missing ${field}`);
  return value.trim().slice(0, maximum);
};

export const parseResumeImprovements = (raw) => {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { invalid("Resume suggestions are not valid JSON"); }
  if (!Array.isArray(parsed?.suggestions) || parsed.suggestions.length < 3 || parsed.suggestions.length > 8) invalid("Resume suggestions have an invalid count");
  const allowedTypes = new Set(["summary", "experience", "skills", "keywords", "formatting"]); const allowedPriorities = new Set(["high", "medium", "low"]);
  const seen = new Set();
  return parsed.suggestions.map((item) => {
    if (!allowedTypes.has(item?.type) || !allowedPriorities.has(item?.priority)) invalid("Resume suggestion has an invalid type or priority");
    const title = clean(item.title, "title", 180); const normalized = title.toLowerCase();
    if (seen.has(normalized)) invalid("Resume suggestions contain duplicate titles"); seen.add(normalized);
    return { type: item.type, title, reason: clean(item.reason, "reason"), example: clean(item.example, "example", 1600), priority: item.priority };
  });
};
