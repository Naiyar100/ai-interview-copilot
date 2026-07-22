import request from "supertest";
import { describe, expect, test } from "@jest/globals";
import app from "../app.js";
import Interview from "../models/Interview.js";
import UserActivity from "../models/UserActivity.js";
import { auth, registerTestUser } from "./helpers.js";

const createEvaluatedInterview = (user, overrides = {}) => Interview.create({
  user, role: "Frontend Developer", experienceLevel: "Fresher", difficulty: "Medium", interviewType: "Technical",
  status: "completed", questions: ["Explain React state", "Why use stable keys?"],
  generatedQuestions: [
    { id: 1, question: "Explain React state", category: "React", difficulty: "Medium", expectedTopics: ["State"] },
    { id: 2, question: "Why use stable keys?", category: "React", difficulty: "Medium", expectedTopics: ["Reconciliation"] },
  ],
  answers: ["State stores changing values in a component and drives rendering.", "Stable keys preserve component identity during reconciliation."],
  transcripts: ["", ""], totalQuestions: 2, answeredQuestions: 2, score: 80, duration: 600,
  startedAt: new Date(Date.now() - 600000), completedAt: new Date(),
  evaluations: [{ overallScore: 80, summary: "Solid", strengths: ["Technical correctness"], improvements: ["Add examples"], questions: [
    { questionId: 1, score: 8, feedback: "Correct", idealAnswer: "Detailed state explanation", topicsToStudy: ["Hooks"] },
    { questionId: 2, score: 8, feedback: "Correct", idealAnswer: "Detailed reconciliation answer", topicsToStudy: ["Virtual DOM"] },
  ], evaluatedAt: new Date() }],
  ...overrides,
});

describe("Phase 12 analytics center", () => {
  test("protects analytics and returns a meaningful empty state", async () => {
    expect((await request(app).get("/api/analytics/overview")).status).toBe(401);
    const current = await registerTestUser();
    const response = await request(app).get("/api/analytics/overview?preset=30d&timezone=Asia/Calcutta").set(auth(current.token));
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.objectContaining({
      summary: expect.objectContaining({ totalInterviews: 0, completionRate: 0 }),
      topicMastery: [], recommendations: expect.any(Array),
      dataAvailability: expect.objectContaining({ interviews: false, evaluations: false }),
    }));
  });

  test("calculates score, median, topics, trends, readiness, voice and previous period metadata", async () => {
    const current = await registerTestUser();
    await Promise.all([
      createEvaluatedInterview(current.user.id, { score: 80 }),
      createEvaluatedInterview(current.user.id, { role: "Backend Developer", difficulty: "Hard", score: 90, voiceMetadata: { mode: "voice", recordingAttempts: 2 }, transcripts: ["spoken answer one", "spoken answer two"] }),
      UserActivity.create({ user: current.user.id, eventKey: "analytics:test:completed", type: "interview_completed", title: "Completed", metadata: { durationMinutes: 10 }, occurredAt: new Date(), xpAwarded: 50 }),
    ]);
    const response = await request(app).get("/api/analytics/overview?preset=30d&timezone=UTC&aggregation=week").set(auth(current.token));
    expect(response.status).toBe(200);
    expect(response.body.data.summary).toEqual(expect.objectContaining({ totalInterviews: 2, completedInterviews: 2, averageScore: 85, medianScore: 85, questionsAnswered: 4 }));
    expect(response.body.data.range.previous).toEqual(expect.objectContaining({ startDate: expect.any(String), endDate: expect.any(String) }));
    expect(response.body.data.topicMastery.map((item) => item.topic)).toEqual(expect.arrayContaining(["React", "State", "Hooks"]));
    expect(response.body.data.performanceTrend).toHaveLength(1);
    expect(response.body.data.voiceAnalytics).toEqual(expect.objectContaining({ interviews: 1, usageRate: 50, recordingAttempts: 2 }));
    expect(response.body.data.roleReadiness).toHaveLength(2);
    expect(response.body.data.companyReadiness).toHaveLength(9);
  });

  test("validates ranges and filters", async () => {
    const current = await registerTestUser();
    expect((await request(app).get("/api/analytics/overview?preset=custom&startDate=2026-07-20&endDate=2026-07-01").set(auth(current.token))).status).toBe(400);
    expect((await request(app).get("/api/analytics/overview?difficulty=Impossible").set(auth(current.token))).status).toBe(400);
    expect((await request(app).get("/api/analytics/overview?scoreMin=90&scoreMax=20").set(auth(current.token))).status).toBe(400);
  });

  test("filters records and prevents cross-user interview comparison", async () => {
    const owner = await registerTestUser(); const stranger = await registerTestUser();
    const first = await createEvaluatedInterview(owner.user.id);
    const second = await createEvaluatedInterview(owner.user.id, { role: "Backend Developer", difficulty: "Hard" });
    const foreign = await createEvaluatedInterview(stranger.user.id);
    const filtered = await request(app).get("/api/analytics/overview?preset=all&difficulty=Hard").set(auth(owner.token));
    expect(filtered.body.data.summary.totalInterviews).toBe(1);
    const compared = await request(app).post("/api/analytics/compare").set(auth(owner.token)).send({ interviewIds: [first._id, second._id] });
    expect(compared.status).toBe(200); expect(compared.body.data.interviews).toHaveLength(2);
    expect((await request(app).post("/api/analytics/compare").set(auth(owner.token)).send({ interviewIds: [first._id, foreign._id] })).status).toBe(403);
  });

  test("supports owned saved views and filtered exports", async () => {
    const current = await registerTestUser();
    await createEvaluatedInterview(current.user.id);
    const created = await request(app).post("/api/analytics/views").set(auth(current.token)).send({ name: "Hard practice", filters: { preset: "30d", difficulty: "Hard", timezone: "UTC" } });
    expect(created.status).toBe(201);
    const id = created.body.data.view.id;
    expect((await request(app).get("/api/analytics/views").set(auth(current.token))).body.data.views).toHaveLength(1);
    expect((await request(app).put(`/api/analytics/views/${id}`).set(auth(current.token)).send({ name: "Hard interviews" })).status).toBe(200);
    const exported = await request(app).post("/api/analytics/export").set(auth(current.token)).send({ format: "pdf", filters: { preset: "30d", timezone: "UTC" } });
    expect(exported.status).toBe(200);
    expect(Buffer.from(exported.body.data.contentBase64, "base64").subarray(0, 4).toString()).toBe("%PDF");
    expect((await request(app).delete(`/api/analytics/views/${id}`).set(auth(current.token))).status).toBe(200);
  });
});
