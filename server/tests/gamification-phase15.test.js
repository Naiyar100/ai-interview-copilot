import request from "supertest";
import { describe, expect, test } from "@jest/globals";
import app from "../app.js";
import ChallengeClaim from "../models/ChallengeClaim.js";
import UserActivity from "../models/UserActivity.js";
import { auth, registerTestUser } from "./helpers.js";

const questionActivity = (user, count = 5) => ({
  user,
  eventKey: `test:questions:${count}:${Date.now()}:${Math.random()}`,
  type: "question_answered",
  title: "Questions answered",
  description: "Test activity",
  metadata: { count },
  xpAwarded: count * 5,
  occurredAt: new Date(),
});

describe("Phase 15 gamification", () => {
  test("protects all gamification endpoints", async () => {
    const paths = [
      "/api/gamification/profile",
      "/api/gamification/challenges",
      "/api/gamification/badges",
      "/api/gamification/history",
      "/api/gamification/leaderboard",
    ];
    for (const path of paths) expect((await request(app).get(path)).status).toBe(401);
  });

  test("returns user-specific profile, challenges, badges and history", async () => {
    const current = await registerTestUser();
    const other = await registerTestUser();
    await UserActivity.create([
      questionActivity(current.user.id),
      questionActivity(other.user.id, 20),
    ]);
    const [profile, challenges, badges, history] = await Promise.all([
      request(app).get("/api/gamification/profile").set(auth(current.token)),
      request(app).get("/api/gamification/challenges").set(auth(current.token)),
      request(app).get("/api/gamification/badges").set(auth(current.token)),
      request(app).get("/api/gamification/history").set(auth(current.token)),
    ]);
    expect(profile.status).toBe(200);
    expect(profile.body.data.profile.xp).toBe(25);
    expect(profile.body.data.xpRules.questionAnswered).toBe(5);
    expect(challenges.body.data.challenges.find((item) => item.key === "daily_questions").completed).toBe(true);
    expect(Array.isArray(badges.body.data.badges)).toBe(true);
    expect(history.body.data.history).toHaveLength(1);
  });

  test("claims an eligible reward once and prevents duplicate XP", async () => {
    const current = await registerTestUser();
    await UserActivity.create(questionActivity(current.user.id));
    const first = await request(app).post("/api/gamification/challenges/daily_questions/claim").set(auth(current.token));
    const duplicate = await request(app).post("/api/gamification/challenges/daily_questions/claim").set(auth(current.token));
    expect(first.status).toBe(200);
    expect(first.body.data.xp).toBe(50);
    expect(duplicate.status).toBe(409);
    expect(await ChallengeClaim.countDocuments({ user: current.user.id })).toBe(1);
    expect(await UserActivity.countDocuments({ user: current.user.id, type: "challenge_reward" })).toBe(1);
  });

  test("rejects incomplete claims and ranks users by persisted XP", async () => {
    const current = await registerTestUser();
    const leader = await registerTestUser();
    await UserActivity.create([
      questionActivity(current.user.id, 1),
      questionActivity(leader.user.id, 20),
    ]);
    const claim = await request(app).post("/api/gamification/challenges/daily_questions/claim").set(auth(current.token));
    const leaderboard = await request(app).get("/api/gamification/leaderboard").set(auth(current.token));
    expect(claim.status).toBe(400);
    expect(leaderboard.body.data.leaderboard[0].name).toBe(leader.user.name);
    expect(leaderboard.body.data.leaderboard.find((item) => item.isCurrentUser)).toBeDefined();
  });
});
