import request from "supertest";
import { describe, expect, test } from "@jest/globals";
import app from "../app.js";
import Interview from "../models/Interview.js";
import UserActivity from "../models/UserActivity.js";
import UserBadge from "../models/UserBadge.js";
import UserProgress from "../models/UserProgress.js";
import { auth, registerTestUser } from "./helpers.js";

const completedInterview = (userId, overrides = {}) => ({
  user: userId,
  role: "Frontend Developer",
  experienceLevel: "Fresher",
  difficulty: "Medium",
  interviewType: "Technical",
  status: "completed",
  questions: ["Explain React state"],
  answers: ["State stores changing component data"],
  totalQuestions: 1,
  answeredQuestions: 1,
  generatedQuestions: [{ id: 1, question: "Explain React state", category: "React", difficulty: "Medium", expectedTopics: ["React state"] }],
  evaluations: [{
    overallScore: 85,
    summary: "Strong answer",
    strengths: ["Clarity"],
    improvements: ["More examples"],
    questions: [{ questionId: 1, score: 8.5, feedback: "Good", idealAnswer: "Detailed answer", topicsToStudy: ["State management"] }],
    evaluatedAt: new Date(),
  }],
  score: 85,
  duration: 600,
  startedAt: new Date(Date.now() - 600000),
  completedAt: new Date(),
  ...overrides,
});

describe("Phase 11 dashboard overview and gamification", () => {
  test("protects overview and returns a polished empty state for a new user", async () => {
    expect((await request(app).get("/api/dashboard/overview")).status).toBe(401);
    const current = await registerTestUser();
    const response = await request(app).get("/api/dashboard/overview?timezone=Asia/Calcutta").set(auth(current.token));
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.objectContaining({
      summary: expect.objectContaining({ totalInterviews: 0, questionsAnswered: 0, currentStreak: 0 }),
      continueInterview: null,
      recentInterviews: [],
      weakTopics: [],
      weeklyProgress: expect.any(Array),
      heatmap: expect.any(Array),
    }));
    expect(response.body.data.weeklyProgress).toHaveLength(7);
    expect(response.body.data.heatmap).toHaveLength(84);
    expect(response.body.data.dailyGoal.timezone).toBe("Asia/Calcutta");
  });

  test("calculates counts, scores, topics, continue selection, streak, XP and badges idempotently", async () => {
    const current = await registerTestUser();
    const completed = await Interview.create(completedInterview(current.user.id));
    const draft = await Interview.create({
      user: current.user.id, role: "Backend Developer", experienceLevel: "Fresher",
      difficulty: "Hard", interviewType: "Technical", status: "draft",
      questions: ["Explain indexes"], answers: [""], totalQuestions: 1,
    });
    const first = await request(app).get("/api/dashboard/overview?timezone=UTC").set(auth(current.token));
    expect(first.status).toBe(200);
    expect(first.body.data.summary).toEqual(expect.objectContaining({
      totalInterviews: 2, completedInterviews: 1, averageScore: 85,
      highestScore: 85, questionsAnswered: 1, totalPracticeMinutes: 10,
    }));
    expect(first.body.data.continueInterview.id).toBe(draft._id.toString());
    expect(first.body.data.strongTopics.map((item) => item.topic)).toEqual(expect.arrayContaining(["React state", "State management"]));
    expect(first.body.data.activity.length).toBeGreaterThan(0);
    expect(first.body.data.gamification.xp).toBeGreaterThan(0);
    expect(first.body.data.badges.find((item) => item.key === "first_interview").earned).toBe(true);

    const activityCount = await UserActivity.countDocuments({ user: current.user.id });
    const badgeCount = await UserBadge.countDocuments({ user: current.user.id });
    const xp = (await UserProgress.findOne({ user: current.user.id })).xp;
    await request(app).get("/api/dashboard/overview?timezone=UTC").set(auth(current.token));
    expect(await UserActivity.countDocuments({ user: current.user.id })).toBe(activityCount);
    expect(await UserBadge.countDocuments({ user: current.user.id })).toBe(badgeCount);
    expect((await UserProgress.findOne({ user: current.user.id })).xp).toBe(xp);
    expect(await Interview.exists({ _id: completed._id })).toBeTruthy();
  });

  test("updates and validates the timezone-aware daily goal", async () => {
    const current = await registerTestUser();
    const updated = await request(app).put("/api/dashboard/goal").set(auth(current.token)).send({ target: 8, timezone: "Asia/Calcutta" });
    expect(updated.status).toBe(200);
    expect(updated.body.data.goal).toEqual(expect.objectContaining({ target: 8, timezone: "Asia/Calcutta" }));
    expect((await request(app).put("/api/dashboard/goal").set(auth(current.token)).send({ target: 0, timezone: "UTC" })).status).toBe(400);
    expect((await request(app).put("/api/dashboard/goal").set(auth(current.token)).send({ target: 5, timezone: "Mars/Olympus" })).status).toBe(400);
  });
});

describe("scheduled interview ownership and validation", () => {
  test("creates, lists, edits and cancels an owned schedule", async () => {
    const current = await registerTestUser();
    const future = new Date(Date.now() + 86400000).toISOString();
    const created = await request(app).post("/api/scheduled-interviews").set(auth(current.token)).send({
      title: "React practice", role: "Frontend Developer", interviewType: "Technical",
      difficulty: "Medium", scheduledAt: future, notes: "Focus on hooks",
    });
    expect(created.status).toBe(201);
    const id = created.body.data.schedule.id;
    const list = await request(app).get("/api/scheduled-interviews").set(auth(current.token));
    expect(list.body.data.schedules).toHaveLength(1);
    const updated = await request(app).put(`/api/scheduled-interviews/${id}`).set(auth(current.token)).send({ difficulty: "Hard" });
    expect(updated.status).toBe(200);
    expect(updated.body.data.schedule.difficulty).toBe("Hard");
    expect((await request(app).delete(`/api/scheduled-interviews/${id}`).set(auth(current.token))).status).toBe(200);
    expect((await request(app).get("/api/scheduled-interviews").set(auth(current.token))).body.data.schedules).toHaveLength(0);
  });

  test("rejects invalid schedules and cross-user access", async () => {
    const owner = await registerTestUser();
    const stranger = await registerTestUser();
    expect((await request(app).post("/api/scheduled-interviews").set(auth(owner.token)).send({ title: "", role: "", scheduledAt: "bad" })).status).toBe(400);
    const created = await request(app).post("/api/scheduled-interviews").set(auth(owner.token)).send({
      title: "System design", role: "Backend Developer", interviewType: "Technical",
      difficulty: "Hard", scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    });
    const id = created.body.data.schedule.id;
    expect((await request(app).put(`/api/scheduled-interviews/${id}`).set(auth(stranger.token)).send({ title: "Stolen" })).status).toBe(403);
    expect((await request(app).delete(`/api/scheduled-interviews/${id}`).set(auth(stranger.token))).status).toBe(403);
  });
});
