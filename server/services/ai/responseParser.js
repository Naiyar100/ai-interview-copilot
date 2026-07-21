const invalidResponse = (message) => {
  const error = new Error(message);
  error.code = "INVALID_AI_RESPONSE";
  error.retryable = true;
  return error;
};

const parseJson = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    throw invalidResponse("The AI provider returned an empty response");
  }

  try {
    return JSON.parse(value.trim());
  } catch {
    throw invalidResponse("The AI provider returned invalid JSON");
  }
};

export const parseInterviewQuestions = (rawResponse, expectedCount) => {
  const parsed = parseJson(rawResponse);

  if (!parsed || !Array.isArray(parsed.questions)) {
    throw invalidResponse("The AI response is missing questions");
  }
  if (parsed.questions.length !== expectedCount) {
    throw invalidResponse("The AI response returned the wrong number of questions");
  }

  const ids = new Set();
  const questionTexts = new Set();
  const questions = parsed.questions.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw invalidResponse(`Question ${index + 1} has an invalid format`);
    }

    const id = item.id;
    const question = typeof item.question === "string" ? item.question.trim() : "";
    const category = typeof item.category === "string" ? item.category.trim() : "";
    const difficulty = item.difficulty;
    const expectedTopics = Array.isArray(item.expectedTopics)
      ? item.expectedTopics
          .filter((topic) => typeof topic === "string" && topic.trim())
          .map((topic) => topic.trim())
      : null;

    if (!Number.isInteger(id) || id < 1 || id > expectedCount || ids.has(id)) {
      throw invalidResponse(`Question ${index + 1} has an invalid or duplicate id`);
    }
    if (!question || !category || !["Easy", "Medium", "Hard"].includes(difficulty)) {
      throw invalidResponse(`Question ${index + 1} is missing required fields`);
    }
    if (!expectedTopics) {
      throw invalidResponse(`Question ${index + 1} has invalid expected topics`);
    }

    const normalizedText = question.toLocaleLowerCase().replace(/\s+/g, " ");
    if (questionTexts.has(normalizedText)) {
      throw invalidResponse("The AI response contains duplicate questions");
    }

    ids.add(id);
    questionTexts.add(normalizedText);
    return { id, question, category, difficulty, expectedTopics };
  });

  return questions;
};
