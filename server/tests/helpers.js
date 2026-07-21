import request from "supertest";
import app from "../app.js";

let sequence = 0;

export const registerTestUser = async (overrides = {}) => {
  sequence += 1;
  const credentials = {
    name: `Test User ${sequence}`,
    email: `user${sequence}@example.com`,
    password: "Secure123!",
    ...overrides,
  };
  const response = await request(app).post("/api/auth/register").send(credentials);
  return { credentials, response, token: response.body.data?.token, user: response.body.data?.user };
};

export const auth = (token) => ({ Authorization: `Bearer ${token}` });

export const questionResponse = (count = 2) => ({
  output_text: JSON.stringify({
    questions: Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      question: `Test question ${index + 1}?`,
      category: "Technical",
      difficulty: "Medium",
      expectedTopics: ["Testing"],
    })),
  }),
});

export const evaluationResponse = (count = 2) => ({
  output_text: JSON.stringify({
    overallScore: 80,
    summary: "A solid interview performance.",
    strengths: ["Clear communication"],
    improvements: ["Add more examples"],
    questions: Array.from({ length: count }, (_, index) => ({
      questionId: index + 1,
      score: 8,
      feedback: "Good answer with relevant detail.",
      idealAnswer: "A complete example-backed answer.",
      topicsToStudy: ["Testing"],
    })),
  }),
});
