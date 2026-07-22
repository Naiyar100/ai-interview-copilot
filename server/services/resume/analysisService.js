import crypto from "node:crypto";
import mongoose from "mongoose";
import Resume from "../../models/Resume.js";
import ResumeAnalysis from "../../models/ResumeAnalysis.js";
import { calculateAtsAnalysis } from "./atsScorer.js";

const fail = (statusCode, message) => { const error = new Error(message); error.statusCode = statusCode; throw error; };
const cleanCriteria = ({ targetRole = "", jobDescription = "" } = {}) => {
  if (typeof targetRole !== "string" || typeof jobDescription !== "string") fail(400, "Target role and job description must be text");
  const role = targetRole.replace(/[<>$\0{}]/g, "").replace(/\s+/g, " ").trim();
  const description = jobDescription.replace(/\0/g, "").replace(/\s+/g, " ").trim();
  if (role.length > 120) fail(400, "Target role cannot exceed 120 characters");
  if (description.length > 12000) fail(400, "Job description cannot exceed 12,000 characters");
  return { targetRole: role, jobDescription: description };
};

export const criteriaHash = (criteria) => crypto.createHash("sha256").update(JSON.stringify(criteria)).digest("hex");

export const getOwnedResumeForAnalysis = async (resumeId, userId) => {
  if (!mongoose.isValidObjectId(resumeId)) fail(400, "Invalid resume ID");
  const resume = await Resume.findById(resumeId).select("+extractedText");
  if (!resume) fail(404, "Resume not found");
  if (!resume.user.equals(userId)) fail(403, "You do not have access to this resume");
  return resume;
};

export const formatAnalysis = (analysis) => ({
  id: analysis._id, resumeId: analysis.resume, targetRole: analysis.targetRole,
  hasJobDescription: analysis.hasJobDescription, scores: analysis.scores,
  keywordAnalysis: analysis.keywordAnalysis, missingSkills: analysis.missingSkills,
  actionVerbSuggestions: analysis.actionVerbSuggestions, strengths: analysis.strengths,
  issues: analysis.issues, metrics: analysis.metrics, aiSuggestions: analysis.aiSuggestions,
  analyzedAt: analysis.analyzedAt, createdAt: analysis.createdAt, updatedAt: analysis.updatedAt,
});

export const getOrCreateResumeAnalysis = async ({ resumeId, userId, criteria = {} }) => {
  const resume = await getOwnedResumeForAnalysis(resumeId, userId);
  const cleaned = cleanCriteria(criteria); const hash = criteriaHash(cleaned);
  let analysis = await ResumeAnalysis.findOne({ user: userId, resume: resume._id, criteriaHash: hash });
  if (!analysis) {
    const result = calculateAtsAnalysis({ text: resume.extractedText, summary: resume.summary, ...cleaned });
    try {
      analysis = await ResumeAnalysis.create({ user: userId, resume: resume._id, criteriaHash: hash, targetRole: cleaned.targetRole, hasJobDescription: Boolean(cleaned.jobDescription), ...result });
    } catch (error) {
      if (error.code !== 11000) throw error;
      analysis = await ResumeAnalysis.findOne({ user: userId, resume: resume._id, criteriaHash: hash });
    }
  }
  return { resume, analysis, criteria: cleaned };
};

export const createBaselineResumeAnalysis = async (resume) => getOrCreateResumeAnalysis({ resumeId: resume._id, userId: resume.user, criteria: {} });

export const latestAnalysisByResumeIds = async (userId, resumeIds) => {
  const records = await ResumeAnalysis.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId), resume: { $in: resumeIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
    { $sort: { analyzedAt: -1 } }, { $group: { _id: "$resume", analysis: { $first: "$$ROOT" } } },
  ]);
  return new Map(records.map((item) => [item._id.toString(), item.analysis]));
};

export { cleanCriteria };
