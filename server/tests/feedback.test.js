import request from "supertest";
import { describe, expect, test } from "@jest/globals";
import app from "../app.js";
import Feedback from "../models/Feedback.js";
import { auth, registerTestUser } from "./helpers.js";

const validFeedback = {
  rating: 5,
  liked: "The dashboard and interview flow are clear.",
  improvements: "Add more explanations to the reports.",
  foundBug: true,
  bugDescription: "The action briefly appeared disabled.",
  pageOrFeature: "Interview Results",
};

describe("feedback", () => {
  test("stores authenticated feedback using trusted user details", async () => {
    const current = await registerTestUser({
      name: "Feedback Owner",
      email: "owner@example.com",
    });

    const response = await request(app)
      .post("/api/feedback")
      .set(auth(current.token))
      .send({
        ...validFeedback,
        user: "000000000000000000000000",
        userName: "Imposter",
        userEmail: "imposter@example.com",
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
    expect(saved.userName).toBe("Feedback Owner");
    expect(saved.userEmail).toBe("owner@example.com");
    expect(saved).not.toHaveProperty("password");
  });

  test("rejects unauthenticated and invalid feedback", async () => {
    expect(
      (await request(app).post("/api/feedback").send(validFeedback)).status,
    ).toBe(401);

    const current = await registerTestUser();
    const invalidPayloads = [
      { ...validFeedback, rating: 0 },
      { ...validFeedback, liked: "" },
      { ...validFeedback, improvements: "" },
      { ...validFeedback, liked: "x".repeat(1001) },
    ];

    for (const payload of invalidPayloads) {
      const response = await request(app)
        .post("/api/feedback")
        .set(auth(current.token))
        .send(payload);
      expect(response.status).toBe(400);
    }
  });

  test("keeps feedback private to the submission endpoint", async () => {
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
