import request from "supertest";
import { describe, expect, jest, test } from "@jest/globals";
import app from "../app.js";
import Interview from "../models/Interview.js";
import Resume from "../models/Resume.js";
import { auth, evaluationResponse, questionResponse, registerTestUser } from "./helpers.js";

const mockGemini = (payload) => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload });
};

describe("AI generation, evaluation and resume ownership", () => {
  test("generates questions and evaluates a completed interview", async () => {
    const { token } = await registerTestUser();
    const created = await request(app).post("/api/interviews").set(auth(token)).send({
      role: "Frontend Developer", experienceLevel: "Fresher", difficulty: "Medium", interviewType: "Technical", questionCount: 2,
    });
    const id = created.body.data.interview.id;
    mockGemini(questionResponse(2));
    const generated = await request(app).post(`/api/interviews/${id}/generate`).set(auth(token));
    expect(generated.status).toBe(200);
    expect(generated.body.data.questions).toHaveLength(2);

    await request(app).patch(`/api/interviews/${id}/complete`).set(auth(token)).send({ answers: ["Answer one", "Answer two"] });
    mockGemini(evaluationResponse(2));
    const evaluated = await request(app).post(`/api/interviews/${id}/evaluate`).set(auth(token));
    expect(evaluated.status).toBe(201);
    expect(evaluated.body.data.evaluation.overallScore).toBe(80);
    expect((await request(app).post(`/api/interviews/${id}/evaluate`).set(auth(token))).status).toBe(409);
    expect((await request(app).get(`/api/interviews/${id}/evaluations`).set(auth(token))).body.data.evaluations).toHaveLength(1);
  });

  test("maps AI provider failures without leaking internal data", async () => {
    const { token } = await registerTestUser();
    const created = await request(app).post("/api/interviews").set(auth(token)).send({
      role: "Backend Developer", experienceLevel: "Fresher", difficulty: "Easy", interviewType: "Technical", questionCount: 1,
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ secret: "provider detail" }) });
    const response = await request(app).post(`/api/interviews/${created.body.data.interview.id}/generate`).set(auth(token));
    expect(response.status).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain("provider detail");
  });

  test("lists only owned resumes and rejects invalid uploads", async () => {
    const owner = await registerTestUser();
    const stranger = await registerTestUser();
    const resume = await Resume.create({
      user: owner.user.id,
      originalFileName: "resume.pdf",
      storedFileName: "missing-test-file.pdf",
      fileSize: 100,
      mimeType: "application/pdf",
      checksum: "a".repeat(64),
      extractedText: "JavaScript React experience",
      summary: { skills: ["JavaScript"] },
      isActive: true,
    });
    const list = await request(app).get("/api/resumes").set(auth(owner.token));
    expect(list.body.data.resumes).toHaveLength(1);
    expect((await request(app).get(`/api/resumes/${resume._id}`).set(auth(stranger.token))).status).toBe(403);
    expect((await request(app).post("/api/resumes").set(auth(owner.token)).attach("resume", Buffer.from("not pdf"), "resume.txt")).status).toBe(415);
    expect((await request(app).delete(`/api/resumes/${resume._id}`).set(auth(owner.token))).status).toBe(200);
    expect(await Interview.countDocuments({ resume: resume._id })).toBe(0);
  });
});
