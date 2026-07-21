import request from "supertest";
import { describe, expect, test } from "@jest/globals";
import app from "../app.js";
import Interview from "../models/Interview.js";
import { auth, registerTestUser } from "./helpers.js";

const createInterview = (token, overrides = {}) =>
  request(app)
    .post("/api/interviews")
    .set(auth(token))
    .send({
      role: "Frontend Developer",
      experienceLevel: "1-2 Years",
      difficulty: "Medium",
      interviewType: "Technical",
      questionCount: 2,
      ...overrides,
    });

describe("interview CRUD, ownership, pagination, filtering, search and voice", () => {
  test("creates, reads, updates voice transcripts, completes, and deletes an interview", async () => {
    const { token } = await registerTestUser();
    const created = await createInterview(token);
    expect(created.status).toBe(201);
    const id = created.body.data.interview.id;

    await Interview.findByIdAndUpdate(id, {
      questions: ["Question one?", "Question two?"],
      answers: ["", ""],
      transcripts: ["", ""],
    });
    const updated = await request(app).put(`/api/interviews/${id}`).set(auth(token)).send({
      answers: ["My first answer"],
      transcripts: ["My first transcript"],
      voiceMetadata: { mode: "voice", language: "en-US", recordingAttempts: 1 },
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.interview.transcripts[0]).toBe("My first transcript");
    expect(updated.body.data.interview.voiceMetadata.mode).toBe("voice");

    const completed = await request(app).patch(`/api/interviews/${id}/complete`).set(auth(token)).send({ answers: ["Final answer"] });
    expect(completed.status).toBe(200);
    expect(completed.body.data.interview.status).toBe("completed");
    expect((await request(app).get(`/api/interviews/${id}`).set(auth(token))).status).toBe(200);
    expect((await request(app).delete(`/api/interviews/${id}`).set(auth(token))).status).toBe(200);
  });

  test("keeps interviews private and validates IDs", async () => {
    const owner = await registerTestUser();
    const stranger = await registerTestUser();
    const created = await createInterview(owner.token);
    const id = created.body.data.interview.id;
    expect((await request(app).get(`/api/interviews/${id}`).set(auth(stranger.token))).status).toBe(403);
    expect((await request(app).put(`/api/interviews/${id}`).set(auth(stranger.token)).send({ role: "Other" })).status).toBe(403);
    expect((await request(app).delete(`/api/interviews/${id}`).set(auth(stranger.token))).status).toBe(403);
    expect((await request(app).get("/api/interviews/not-an-id").set(auth(owner.token))).status).toBe(400);
  });

  test("paginates, filters, searches and sorts only the current user's interviews", async () => {
    const current = await registerTestUser();
    const other = await registerTestUser();
    await createInterview(current.token, { role: "Frontend Developer", difficulty: "Easy" });
    await createInterview(current.token, { role: "Backend Developer", difficulty: "Hard" });
    await createInterview(other.token, { role: "Frontend Developer", difficulty: "Easy" });

    const page = await request(app).get("/api/interviews?page=1&limit=1&sortOrder=asc").set(auth(current.token));
    expect(page.body.data).toEqual(expect.objectContaining({ totalItems: 2, totalPages: 2, currentPage: 1 }));
    const filtered = await request(app).get("/api/interviews?difficulty=Easy&search=Frontend").set(auth(current.token));
    expect(filtered.body.data.interviews).toHaveLength(1);
    expect(filtered.body.data.interviews[0].role).toBe("Frontend Developer");
    expect((await request(app).get("/api/interviews?page=0&limit=500").set(auth(current.token))).status).toBe(400);
  });
});
