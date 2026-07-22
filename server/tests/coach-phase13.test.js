import request from "supertest";
import { afterEach, describe, expect, jest, test } from "@jest/globals";
import app from "../app.js";
import CoachConversation from "../models/CoachConversation.js";
import { auth, registerTestUser } from "./helpers.js";

const geminiStream = (parts = ["## Focus plan\n", "Practice **React** fundamentals."]) => {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      parts.forEach((text) => controller.enqueue(encoder.encode(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`)));
      controller.close();
    },
  }), { status: 200, headers: { "Content-Type": "text/event-stream" } });
};

afterEach(() => jest.restoreAllMocks());

describe("Phase 13 AI Career Coach", () => {
  test("protects every chat operation", async () => {
    expect((await request(app).get("/api/coach/chats")).status).toBe(401);
    expect((await request(app).post("/api/coach/chat").send({ message: "Help me" })).status).toBe(401);
  });

  test("creates, searches, renames, pins, loads and deletes owned chats", async () => {
    const current = await registerTestUser();
    const created = await request(app).post("/api/coach/chats").set(auth(current.token)).send({ title: "Frontend plan" });
    expect(created.status).toBe(201);
    const id = created.body.data.chat.id;

    const updated = await request(app).patch(`/api/coach/chats/${id}`).set(auth(current.token)).send({ title: "Pinned React plan", pinned: true });
    expect(updated.status).toBe(200);
    expect(updated.body.data.chat).toEqual(expect.objectContaining({ title: "Pinned React plan", pinned: true }));
    const searched = await request(app).get("/api/coach/chats?search=React").set(auth(current.token));
    expect(searched.body.data.chats).toHaveLength(1);
    expect((await request(app).get(`/api/coach/chats/${id}`).set(auth(current.token))).body.data.chat.messages).toEqual([]);
    expect((await request(app).delete(`/api/coach/chats/${id}`).set(auth(current.token))).status).toBe(200);
    expect(await CoachConversation.countDocuments({ user: current.user.id })).toBe(0);
  });

  test("streams and persists user and assistant messages", async () => {
    const current = await registerTestUser();
    jest.spyOn(globalThis, "fetch").mockResolvedValue(geminiStream());
    const response = await request(app).post("/api/coach/chat").set(auth(current.token)).send({ message: "What should I practice next?" });
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.text).toContain("event: meta");
    expect(response.text).toContain("event: chunk");
    expect(response.text).toContain("event: done");
    const conversation = await CoachConversation.findOne({ user: current.user.id });
    expect(conversation.title).toBe("What should I practice next?");
    expect(conversation.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(conversation.messages[1].content).toContain("Practice **React**");
  });

  test("regenerates the last answer without duplicating the user message", async () => {
    const current = await registerTestUser();
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(geminiStream(["First answer"])).mockResolvedValueOnce(geminiStream(["Improved answer"]));
    await request(app).post("/api/coach/chat").set(auth(current.token)).send({ message: "Build a plan" });
    const conversation = await CoachConversation.findOne({ user: current.user.id });
    const response = await request(app).post("/api/coach/chat").set(auth(current.token)).send({ chatId: conversation._id, regenerate: true });
    expect(response.status).toBe(200);
    const updated = await CoachConversation.findById(conversation._id);
    expect(updated.messages).toHaveLength(2);
    expect(updated.messages[1].content).toBe("Improved answer");
    expect(updated.messages[1].regenerated).toBe(true);
  });

  test("keeps the previous answer when regeneration fails", async () => {
    const current = await registerTestUser();
    const conversation = await CoachConversation.create({ user: current.user.id, title: "Safe retry", messages: [{ role: "user", content: "Make a plan" }, { role: "assistant", content: "Original answer" }] });
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const response = await request(app).post("/api/coach/chat").set(auth(current.token)).send({ chatId: conversation._id, regenerate: true });
    expect(response.status).toBe(200);
    expect(response.text).toContain("event: error");
    const unchanged = await CoachConversation.findById(conversation._id);
    expect(unchanged.messages).toHaveLength(2);
    expect(unchanged.messages[1].content).toBe("Original answer");
  });

  test("returns forbidden for another user's conversation and validates input", async () => {
    const owner = await registerTestUser(); const stranger = await registerTestUser();
    const conversation = await CoachConversation.create({ user: owner.user.id, title: "Private", messages: [] });
    expect((await request(app).get(`/api/coach/chats/${conversation._id}`).set(auth(stranger.token))).status).toBe(403);
    expect((await request(app).patch(`/api/coach/chats/${conversation._id}`).set(auth(stranger.token)).send({ pinned: true })).status).toBe(403);
    expect((await request(app).delete(`/api/coach/chats/${conversation._id}`).set(auth(stranger.token))).status).toBe(403);
    expect((await request(app).post("/api/coach/chat").set(auth(owner.token)).send({ message: "   " })).status).toBe(400);
  });
});
