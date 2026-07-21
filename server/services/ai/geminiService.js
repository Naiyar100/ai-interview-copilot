import { requestStructuredGemini } from "./geminiClient.js";
import {
  buildInterviewQuestionPrompt,
  buildQuestionResponseSchema,
} from "./promptBuilder.js";
import { parseInterviewQuestions } from "./responseParser.js";

export const generateInterviewQuestions = (input, options = {}) =>
  requestStructuredGemini(
    {
      prompt: buildInterviewQuestionPrompt(input),
      responseSchema: buildQuestionResponseSchema(input.numberOfQuestions),
      parseResponse: (response) =>
        parseInterviewQuestions(response, input.numberOfQuestions),
      feature: "Question generation",
    },
    options,
  );
