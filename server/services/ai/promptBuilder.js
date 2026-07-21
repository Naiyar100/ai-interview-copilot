const cleanList = (values = []) =>
  values
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim());

export const buildInterviewQuestionPrompt = ({
  role,
  experienceLevel,
  interviewType,
  difficulty,
  numberOfQuestions,
  skills = [],
  resumeSummary = "",
}) => {
  const skillList = cleanList(skills);
  const context = [
    `Role: ${role}`,
    `Experience level: ${experienceLevel}`,
    `Interview type: ${interviewType}`,
    `Difficulty: ${difficulty}`,
    `Exact number of questions: ${numberOfQuestions}`,
  ];

  if (skillList.length) context.push(`Relevant skills: ${skillList.join(", ")}`);
  if (resumeSummary.trim()) context.push(`Resume context: ${resumeSummary.trim()}`);

  return [
    "You are an expert technical interviewer.",
    "Generate a tailored mock interview using the candidate context below.",
    ...context,
    "Return exactly the requested number of distinct, practical interview questions.",
    "Match every question to the requested interview type, level, and difficulty.",
    "Use concise wording and avoid trivia, discriminatory topics, personal data, answers, and explanations.",
    "For Mixed interviews, balance technical and behavioral questions.",
    "Return JSON only. Do not use markdown or code fences.",
  ].join("\n");
};

export const buildQuestionResponseSchema = (numberOfQuestions) => ({
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      minItems: numberOfQuestions,
      maxItems: numberOfQuestions,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "question", "category", "difficulty", "expectedTopics"],
        properties: {
          id: { type: "integer" },
          question: { type: "string" },
          category: { type: "string" },
          difficulty: { type: "string", enum: ["Easy", "Medium", "Hard"] },
          expectedTopics: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
  },
});
