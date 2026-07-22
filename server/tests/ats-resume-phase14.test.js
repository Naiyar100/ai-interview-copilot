import request from "supertest";
import { describe, expect, jest, test } from "@jest/globals";
import app from "../app.js";
import Resume from "../models/Resume.js";
import ResumeAnalysis from "../models/ResumeAnalysis.js";
import { createResumeExport } from "../services/resume/resumeExportService.js";
import { auth, registerTestUser } from "./helpers.js";

const resumeText = `Naiyar Example\nnaiyar@example.com +91 9999999999\nhttps://github.com/example\nSkills\nJavaScript, React, HTML, CSS, Git\nExperience\nDeveloped responsive React applications and improved performance by 35%.\nBuilt accessible components used by 1200 users.\nEducation\nBachelor of Technology\nProjects\nCreated an interview platform with Node.js and MongoDB.`;

const createResume = (user, overrides = {}) => Resume.create({
  user, originalFileName: "resume-v1.pdf", storedFileName: "phase14-missing.pdf", fileSize: 900,
  mimeType: "application/pdf", checksum: `${Math.random()}`.padEnd(64, "0").slice(0, 64), extractedText: resumeText,
  summary: { skills: ["JavaScript", "React", "HTML", "CSS", "Git"], technologies: ["JavaScript", "React", "HTML", "CSS", "Git", "Node.js", "MongoDB"], experience: ["Developed responsive React applications"], education: ["Bachelor of Technology"], projects: ["Interview platform"], keywords: ["react", "javascript", "frontend"] },
  version: 1, isActive: true, ...overrides,
});

const aiSuggestions = { output_text: JSON.stringify({ suggestions: [
  { type: "experience", title: "Quantify each result", reason: "Evidence improves credibility.", example: "Improved [metric] by [percentage].", priority: "high" },
  { type: "keywords", title: "Add relevant testing evidence", reason: "Testing is missing from the target match.", example: "Added [testing tool] coverage for [feature].", priority: "medium" },
  { type: "summary", title: "Align the summary", reason: "State the target role clearly.", example: "Frontend developer focused on [verified strengths].", priority: "low" },
] }) };

const exportAnalysis = (score) => ({ targetRole: "Frontend Developer", analyzedAt: new Date(), scores: { ats: score, resume: score, keyword: score, structure: score, content: score, readability: score }, keywordAnalysis: { matched: [{ keyword: "react", count: 2 }], missing: ["testing"] }, missingSkills: ["testing"], actionVerbSuggestions: [{ weak: "worked on", replacement: "Developed", reason: "Be precise" }], issues: [{ category: "keywords", severity: "medium", message: "Add testing" }], aiSuggestions: [] });

describe("Phase 14 ATS Resume Reviewer", () => {
  test("protects ATS endpoints", async () => {
    expect((await request(app).get("/api/resume/history")).status).toBe(401);
    expect((await request(app).post("/api/resume/analysis").send({ resumeId: "bad" })).status).toBe(401);
  });

  test("calculates and persists an explainable targeted ATS analysis", async () => {
    const current = await registerTestUser(); const resume = await createResume(current.user.id);
    const response = await request(app).post("/api/resume/analysis").set(auth(current.token)).send({ resumeId: resume._id, targetRole: "Frontend Developer", jobDescription: "React TypeScript testing accessibility performance" });
    expect(response.status).toBe(200);
    expect(response.body.data.analysis).toEqual(expect.objectContaining({
      scores: expect.objectContaining({ ats: expect.any(Number), resume: expect.any(Number), keyword: expect.any(Number) }),
      keywordAnalysis: expect.objectContaining({ matched: expect.any(Array), missing: expect.arrayContaining(["typescript", "testing"]) }),
      missingSkills: expect.arrayContaining(["typescript", "testing"]), actionVerbSuggestions: expect.any(Array), issues: expect.any(Array),
    }));
    expect(await ResumeAnalysis.countDocuments({ user: current.user.id, resume: resume._id })).toBe(1);
    expect(JSON.stringify(response.body)).not.toContain("extractedText");
  });

  test("uploads PDFs as ordered database-backed versions with baseline reviews", async () => {
    const current = await registerTestUser();
    const firstPdf = createResumeExport("pdf", { originalFileName: "first.pdf", version: 1 }, exportAnalysis(70)).buffer;
    const secondPdf = createResumeExport("pdf", { originalFileName: "second.pdf", version: 2 }, exportAnalysis(80)).buffer;
    const first = await request(app).post("/api/resume/upload").set(auth(current.token)).attach("resume", firstPdf, { filename: "resume-one.pdf", contentType: "application/pdf" });
    const second = await request(app).post("/api/resume/upload").set(auth(current.token)).attach("resume", secondPdf, { filename: "resume-two.pdf", contentType: "application/pdf" });
    expect(first.status).toBe(201); expect(second.status).toBe(201);
    expect(first.body.data.resume.version).toBe(1); expect(second.body.data.resume.version).toBe(2); expect(second.body.data.resume.isActive).toBe(true);
    const history = await request(app).get("/api/resume/history").set(auth(current.token));
    expect(history.body.data.resumes.map((item) => item.version)).toEqual([2, 1]);
    expect(history.body.data.resumes.every((item) => item.latestAnalysis?.scores?.ats >= 0)).toBe(true);
    await request(app).delete(`/api/resume/${first.body.data.resume.id}`).set(auth(current.token));
    await request(app).delete(`/api/resume/${second.body.data.resume.id}`).set(auth(current.token));
  });

  test("compares only owned resume versions", async () => {
    const owner = await registerTestUser(); const stranger = await registerTestUser();
    const first = await createResume(owner.user.id); const second = await createResume(owner.user.id, { version: 2, isActive: false, originalFileName: "resume-v2.pdf" });
    const foreign = await createResume(stranger.user.id);
    const compared = await request(app).post("/api/resume/compare").set(auth(owner.token)).send({ resumeIds: [first._id, second._id], targetRole: "Frontend Developer" });
    expect(compared.status).toBe(200); expect(compared.body.data.comparison).toHaveLength(2); expect(compared.body.data.recommendedResumeId).toBeTruthy();
    expect((await request(app).post("/api/resume/compare").set(auth(owner.token)).send({ resumeIds: [first._id, foreign._id] })).status).toBe(403);
  });

  test("generates grounded AI improvements and stores them", async () => {
    const current = await registerTestUser(); const resume = await createResume(current.user.id);
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => aiSuggestions });
    const response = await request(app).post("/api/resume/improve").set(auth(current.token)).send({ resumeId: resume._id, targetRole: "Frontend Developer" });
    expect(response.status).toBe(200); expect(response.body.data.analysis.aiSuggestions).toHaveLength(3);
    expect((await ResumeAnalysis.findOne({ resume: resume._id })).aiSuggestions[0].example).toContain("[metric]");
  });

  test("exports owned ATS reports as valid PDF and CSV", async () => {
    const current = await registerTestUser(); const resume = await createResume(current.user.id);
    const pdf = await request(app).post("/api/resume/export").set(auth(current.token)).send({ resumeId: resume._id, format: "pdf", targetRole: "Frontend Developer" });
    expect(pdf.status).toBe(200); expect(Buffer.from(pdf.body.data.contentBase64, "base64").subarray(0, 5).toString()).toBe("%PDF-");
    const csv = await request(app).post("/api/resume/export").set(auth(current.token)).send({ resumeId: resume._id, format: "csv" });
    expect(csv.status).toBe(200); expect(Buffer.from(csv.body.data.contentBase64, "base64").toString()).toContain("ATS Resume Review");
    expect((await request(app).post("/api/resume/export").set(auth(current.token)).send({ resumeId: resume._id, format: "docx" })).status).toBe(400);
  });

  test("produces a multi-page-safe PDF report service", () => {
    const analysis = { targetRole: "Frontend Developer", analyzedAt: new Date(), scores: { ats: 80, resume: 78, keyword: 75, structure: 90, content: 72, readability: 85 }, keywordAnalysis: { matched: [{ keyword: "react", count: 3 }], missing: ["testing"] }, missingSkills: ["testing"], actionVerbSuggestions: [{ weak: "worked on", replacement: "Developed", reason: "Be precise" }], issues: [{ category: "keywords", severity: "medium", message: "Add testing evidence" }], aiSuggestions: Array.from({ length: 8 }, (_, index) => ({ title: `Suggestion ${index + 1}`, priority: "medium", reason: "A detailed reason ".repeat(8), example: "A grounded example [metric] ".repeat(8) })) };
    const file = createResumeExport("pdf", { originalFileName: "resume.pdf", version: 2 }, analysis);
    expect(file.buffer.subarray(0, 5).toString()).toBe("%PDF-"); expect(file.buffer.toString()).toContain("/Count 2");
  });
});
