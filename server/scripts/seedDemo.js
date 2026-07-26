import dotenv from "dotenv";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import validateEnvironment from "../config/env.js";
import User from "../models/User.js";
import Interview from "../models/Interview.js";
import Resume from "../models/Resume.js";
import ResumeAnalysis from "../models/ResumeAnalysis.js";
import UserActivity from "../models/UserActivity.js";
import { createResumeExport } from "../services/resume/resumeExportService.js";
import {
  createStoredResumeName,
  deleteStoredResume,
  ensureResumeUploadDirectory,
  RESUME_UPLOAD_DIRECTORY,
  storeResume,
} from "../services/resume/storage.js";
import path from "node:path";

dotenv.config();

const email = process.env.DEMO_EMAIL?.trim().toLowerCase() || "demo@example.com";
const password = process.env.DEMO_PASSWORD?.trim();
const name = process.env.DEMO_NAME?.trim() || "Demo User";

if (!password || password.length < 8) {
  throw new Error("DEMO_PASSWORD must contain at least 8 characters");
}

validateEnvironment();
await connectDB();

let storedAsset;
try {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const oldResumes = await Resume.find({ user: existingUser._id }).select("+storedFileName storageProvider");
    await Promise.allSettled(oldResumes.map((resume) => deleteStoredResume(resume.storedFileName, resume.storageProvider)));
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((collection) => collection.deleteMany({ user: existingUser._id })));
    await User.deleteOne({ _id: existingUser._id });
  }

  const user = await User.create({ name, email, password });
  const now = Date.now();
  const completedInterview = (daysAgo, role, difficulty, score, question) => ({
    user: user._id,
    role,
    experienceLevel: "1-2 Years",
    difficulty,
    interviewType: "Technical",
    status: "completed",
    totalQuestions: 3,
    answeredQuestions: 3,
    questions: [question, "How would you test this implementation?", "Which trade-offs would you discuss?"],
    answers: [
      "I would separate responsibilities, validate inputs, and keep state changes predictable.",
      "I would cover the happy path, failures, permissions, and boundary cases with automated tests.",
      "I would explain performance, maintainability, accessibility, and operational trade-offs.",
    ],
    transcripts: ["", "", ""],
    score,
    duration: 18 + daysAgo,
    startedAt: new Date(now - daysAgo * 86400000 - 1500000),
    completedAt: new Date(now - daysAgo * 86400000),
    evaluations: [{
      overallScore: score,
      summary: "A clear answer with practical engineering judgment and room for deeper examples.",
      strengths: ["Structured communication", "Practical testing awareness"],
      improvements: ["Use more measurable examples", "Explain alternatives in greater depth"],
      questions: [1, 2, 3].map((questionId) => ({
        questionId,
        score: Math.round(score / 10),
        feedback: "The answer is relevant and understandable.",
        idealAnswer: "Explain the approach, its trade-offs, validation, tests, and production considerations.",
        topicsToStudy: ["System design", "Testing"],
      })),
      evaluatedAt: new Date(now - daysAgo * 86400000 + 60000),
    }],
    createdAt: new Date(now - daysAgo * 86400000 - 1800000),
    updatedAt: new Date(now - daysAgo * 86400000),
  });

  const interviews = await Interview.create([
    completedInterview(2, "Frontend Developer", "Medium", 88, "How do you design accessible React components?"),
    completedInterview(8, "Full Stack Developer", "Hard", 81, "How would you design a resilient REST API?"),
    completedInterview(15, "Frontend Developer", "Easy", 76, "Explain React state and derived values."),
  ]);

  const resumeAnalysis = {
    targetRole: "Frontend Developer",
    analyzedAt: new Date(),
    scores: { ats: 84, resume: 82, keyword: 86, structure: 80, content: 83, readability: 85 },
    keywordAnalysis: {
      matched: [{ keyword: "React", count: 4 }, { keyword: "JavaScript", count: 3 }],
      missing: ["Web performance"],
      coverage: 86,
    },
    missingSkills: ["Web performance"],
    actionVerbSuggestions: [{ weak: "worked on", replacement: "delivered", reason: "Use a specific outcome-oriented verb." }],
    strengths: ["Clear frontend focus", "Relevant project experience"],
    issues: [{ category: "impact", severity: "medium", message: "Add measurable outcomes to project bullets." }],
    aiSuggestions: [],
  };
  const pdf = createResumeExport("pdf", { originalFileName: "demo-resume.pdf", version: 1 }, resumeAnalysis);
  await ensureResumeUploadDirectory();
  const storedFileName = createStoredResumeName();
  const temporaryPath = path.join(RESUME_UPLOAD_DIRECTORY, storedFileName);
  await writeFile(temporaryPath, pdf.buffer);
  storedAsset = await storeResume(temporaryPath, storedFileName);

  const resume = await Resume.create({
    user: user._id,
    originalFileName: "demo-resume.pdf",
    storedFileName: storedAsset.storageKey,
    storageProvider: storedAsset.storageProvider,
    fileSize: pdf.buffer.length,
    mimeType: "application/pdf",
    checksum: createHash("sha256").update(pdf.buffer).digest("hex"),
    extractedText: "Frontend Developer React JavaScript CSS REST API accessibility testing. Built responsive applications and reusable components.",
    summary: {
      skills: ["React", "JavaScript", "CSS", "REST APIs"],
      education: ["Bachelor of Technology"],
      experience: ["Frontend development experience"],
      projects: ["AI Interview Copilot"],
      certifications: [],
      technologies: ["React", "Node.js", "MongoDB"],
      keywords: ["frontend", "accessibility", "testing"],
    },
    version: 1,
    isActive: true,
  });

  await ResumeAnalysis.create({
    user: user._id,
    resume: resume._id,
    criteriaHash: "demo-frontend-developer",
    ...resumeAnalysis,
  });

  await UserActivity.create(interviews.flatMap((interview, index) => [
    {
      user: user._id,
      eventKey: `demo-interview-${interview._id}`,
      type: "interview_completed",
      title: `${interview.role} interview completed`,
      description: `Completed with a score of ${interview.score}/100.`,
      relatedEntityType: "interview",
      relatedEntityId: interview._id,
      xpAwarded: 80,
      occurredAt: interview.completedAt,
    },
    {
      user: user._id,
      eventKey: `demo-evaluation-${interview._id}`,
      type: "evaluation_generated",
      title: "AI feedback generated",
      relatedEntityType: "interview",
      relatedEntityId: interview._id,
      xpAwarded: 35,
      occurredAt: new Date(interview.completedAt.getTime() + (index + 1) * 60000),
    },
  ]));

  console.log(`Demo account seeded: ${email}`);
} catch (error) {
  if (storedAsset) {
    await deleteStoredResume(storedAsset.storageKey, storedAsset.storageProvider).catch(() => {});
  }
  throw error;
} finally {
  await mongoose.connection.close();
}
