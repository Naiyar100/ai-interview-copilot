import { requestStructuredGemini } from "../ai/geminiClient.js";
import {
  buildEvaluationPrompt,
  buildEvaluationResponseSchema,
} from "./promptBuilder.js";
import { parseEvaluationResponse } from "./responseParser.js";
import { calculateOverallScore } from "./scoreCalculator.js";

export const evaluateInterviewAnswers = async (input, options = {}) => {
  const evaluation = await requestStructuredGemini(
    {
      prompt: buildEvaluationPrompt(input),
      responseSchema: buildEvaluationResponseSchema(input.questions.length),
      parseResponse: (response) =>
        parseEvaluationResponse(response, input.questions.length),
      feature: "Interview evaluation",
    },
    options,
  );

  return {
    overallScore: calculateOverallScore(evaluation.questions),
    summary: evaluation.summary,
    strengths: evaluation.strengths,
    improvements: evaluation.improvements,
    questions: evaluation.questions,
  };
};
