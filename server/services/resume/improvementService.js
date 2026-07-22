import { requestStructuredGemini } from "../ai/geminiClient.js";
import { buildResumeImprovementPrompt, buildResumeImprovementSchema } from "./improvementPromptBuilder.js";
import { parseResumeImprovements } from "./improvementResponseParser.js";

export const generateResumeImprovements = ({ resume, analysis, targetRole, jobDescription }, options = {}) => requestStructuredGemini({
  prompt: buildResumeImprovementPrompt({ resume, analysis, targetRole, jobDescription }),
  responseSchema: buildResumeImprovementSchema(), parseResponse: parseResumeImprovements, feature: "Resume improvement",
}, options);
