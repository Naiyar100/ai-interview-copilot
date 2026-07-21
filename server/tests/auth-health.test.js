import request from "supertest";
import { describe, expect, test } from "@jest/globals";
import app from "../app.js";
import { auth, registerTestUser } from "./helpers.js";

describe("authentication, protection, validation and health", () => {
  test("registers, logs in, and returns only safe user fields", async () => {
    const { credentials, response, token } = await registerTestUser();
    expect(response.status).toBe(201);
    expect(response.body.data.user).not.toHaveProperty("password");

    const login = await request(app).post("/api/auth/login").send({
      email: credentials.email.toUpperCase(),
      password: credentials.password,
    });
    expect(login.status).toBe(200);
    expect(login.body.data.token).toEqual(expect.any(String));

    const profile = await request(app).get("/api/users/me").set(auth(token));
    expect(profile.status).toBe(200);
    expect(profile.body.data.user.email).toBe(credentials.email);
  });

  test("rejects invalid input, bad credentials, missing JWT, and injection keys", async () => {
    expect((await request(app).post("/api/auth/register").send({ name: "", email: "bad", password: "1" })).status).toBe(400);
    await registerTestUser({ email: "known@example.com" });
    expect((await request(app).post("/api/auth/login").send({ email: "known@example.com", password: "wrong-password" })).status).toBe(401);
    expect((await request(app).get("/api/interviews")).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email: { $ne: null }, password: "password" })).status).toBe(400);
  });

  test("returns security headers, CORS protection, JSON 404, and health details", async () => {
    const health = await request(app).get("/api/health").set("Origin", "http://localhost:5173");
    expect(health.status).toBe(200);
    expect(health.headers["x-content-type-options"]).toBe("nosniff");
    expect(health.body.data).toEqual(expect.objectContaining({ status: "ok", database: "connected", aiProvider: "configured" }));

    expect((await request(app).get("/api/health").set("Origin", "https://evil.example")).status).toBe(403);
    const missing = await request(app).get("/api/does-not-exist");
    expect(missing.status).toBe(404);
    expect(missing.body.success).toBe(false);
  });

  test("updates profiles and calculates an owned dashboard summary", async () => {
    const current = await registerTestUser();
    const other = await registerTestUser();
    const updated = await request(app).put("/api/users/me").set(auth(current.token)).send({
      name: "Updated Person",
      email: "updated@example.com",
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.user.name).toBe("Updated Person");
    expect((await request(app).put("/api/users/me").set(auth(current.token)).send({ name: "Duplicate", email: other.credentials.email })).status).toBe(409);

    await request(app).post("/api/interviews").set(auth(current.token)).send({
      role: "Frontend Developer", experienceLevel: "Fresher", difficulty: "Medium", interviewType: "Technical", questionCount: 1,
    });
    await request(app).post("/api/interviews").set(auth(other.token)).send({
      role: "Backend Developer", experienceLevel: "Fresher", difficulty: "Hard", interviewType: "Technical", questionCount: 1,
    });
    const dashboard = await request(app).get("/api/dashboard/summary").set(auth(current.token));
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.totalInterviews).toBe(1);
    expect(dashboard.body.data.mostCommonRole).toBe("Frontend Developer");
  });
});
