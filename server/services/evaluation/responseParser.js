const invalidResponse = (message) => {
  const error = new Error(message);
  error.code = "INVALID_AI_RESPONSE";
  error.retryable = true;
  return error;
};

const parseJson = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    throw invalidResponse("The AI provider returned an empty evaluation");
  }
  try {
    return JSON.parse(value.trim());
  } catch {
    throw invalidResponse("The AI provider returned invalid evaluation JSON");
  }
};

const cleanString = (value, field) => {
  if (typeof value !== "string" || !value.trim()) {
    throw invalidResponse(`The evaluation is missing ${field}`);
  }
  return value.trim();
};

const cleanStringArray = (value, field, allowEmpty = false) => {
  if (!Array.isArray(value)) throw invalidResponse(`${field} must be an array`);
  const cleaned = value.map((item) => cleanString(item, field));
  if (!allowEmpty && !cleaned.length) throw invalidResponse(`${field} cannot be empty`);
  return [...new Map(cleaned.map((item) => [item.toLowerCase(), item])).values()];
};

export const parseEvaluationResponse = (rawResponse, expectedQuestionCount) => {
  const parsed = parseJson(rawResponse);
  if (!Number.isInteger(parsed.overallScore) || parsed.overallScore < 0 || parsed.overallScore > 100) {
    throw invalidResponse("The evaluation has an invalid overall score");
  }
  if (!Array.isArray(parsed.questions) || parsed.questions.length !== expectedQuestionCount) {
    throw invalidResponse("The evaluation has the wrong number of question results");
  }

  const questionIds = new Set();
  const questions = parsed.questions.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw invalidResponse(`Question feedback ${index + 1} is invalid`);
    }
    if (
      !Number.isInteger(item.questionId) ||
      item.questionId < 1 ||
      item.questionId > expectedQuestionCount ||
      questionIds.has(item.questionId)
    ) {
      throw invalidResponse(`Question feedback ${index + 1} has an invalid id`);
    }
    if (typeof item.score !== "number" || !Number.isFinite(item.score) || item.score < 0 || item.score > 10) {
      throw invalidResponse(`Question feedback ${index + 1} has an invalid score`);
    }
    questionIds.add(item.questionId);
    return {
      questionId: item.questionId,
      score: Number(item.score.toFixed(1)),
      feedback: cleanString(item.feedback, "feedback"),
      idealAnswer: cleanString(item.idealAnswer, "idealAnswer"),
      topicsToStudy: cleanStringArray(item.topicsToStudy, "topicsToStudy", true),
    };
  });

  questions.sort((a, b) => a.questionId - b.questionId);
  return {
    aiOverallScore: parsed.overallScore,
    summary: cleanString(parsed.summary, "summary"),
    strengths: cleanStringArray(parsed.strengths, "strengths"),
    improvements: cleanStringArray(parsed.improvements, "improvements"),
    questions,
  };
};
