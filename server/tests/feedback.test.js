import request from "supertest";
import { describe, expect, test } from "@jest/globals";
import app from "../app.js";
import Feedback from "../models/Feedback.js";
import { auth, registerTestUser } from "./helpers.js";

const validFeedback = {
  name: "Naiyar Alam",
  email: "naiyar@example.com",
  feedback: "The interview flow is clear and helpful.",
};

describe("feedback", () => {
  test("stores authenticated feedback with the JWT user association", async () => {
    const current = await registerTestUser({
      name: "Account Owner",
      email: "owner@example.com",
    });

    const response = await request(app)
      .post("/api/feedback")
      .set(auth(current.token))
      .send({
        ...validFeedback,
        user: "000000000000000000000000",
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        message: "Thank you for your feedback",
      }),
    );

    const saved = await Feedback.findById(response.body.data.feedback.id);
    expect(saved.user.toString()).toBe(current.user.id.toString());
    expect(saved.name).toBe(validFeedback.name);
    expect(saved.email).toBe(validFeedback.email);
    expect(saved.feedback).toBe(validFeedback.feedback);
  });

  test("rejects unauthenticated submissions", async () => {
    const response = await request(app).post("/api/feedback").send(validFeedback);
    expect(response.status).toBe(401);
  });

  test.each([
    ["empty name", { ...validFeedback, name: "" }],
    ["invalid email", { ...validFeedback, email: "not-an-email" }],
    ["empty feedback", { ...validFeedback, feedback: "" }],
    ["oversized feedback", { ...validFeedback, feedback: "x".repeat(2001) }],
  ])("rejects %s", async (label, payload) => {
    void label;
    const current = await registerTestUser();
    const response = await request(app)
      .post("/api/feedback")
      .set(auth(current.token))
      .send(payload);
    expect(response.status).toBe(400);
  });

  test("does not expose feedback listing or detail routes", async () => {
    const owner = await registerTestUser();
    const other = await registerTestUser();
    const created = await request(app)
      .post("/api/feedback")
      .set(auth(owner.token))
      .send(validFeedback);

    expect(created.status).toBe(201);
    expect(
      (await request(app).get("/api/feedback").set(auth(other.token))).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .get(`/api/feedback/${created.body.data.feedback.id}`)
          .set(auth(other.token))
      ).status,
    ).toBe(404);
  });
});
