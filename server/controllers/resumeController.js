import path from "node:path";
import mongoose from "mongoose";
import Resume from "../models/Resume.js";
import ResumeAnalysis from "../models/ResumeAnalysis.js";
import { analyzeResume } from "../services/resume/analyzer.js";
import { parseResumePdf } from "../services/resume/parser.js";
import {
  calculateResumeChecksum,
  deleteStoredResume,
} from "../services/resume/storage.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { recordActivitySafe } from "../services/dashboard/activityService.js";
import { invalidateAnalyticsCache } from "../services/analytics/cacheService.js";
import { createBaselineResumeAnalysis, formatAnalysis, getOrCreateResumeAnalysis, latestAnalysisByResumeIds } from "../services/resume/analysisService.js";
import { generateResumeImprovements } from "../services/resume/improvementService.js";
import { createResumeExport } from "../services/resume/resumeExportService.js";

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const formatResume = (resume, analysis = null) => ({
  id: resume._id,
  originalFileName: resume.originalFileName,
  fileSize: resume.fileSize,
  mimeType: resume.mimeType,
  summary: resume.summary,
  version: resume.version || 1,
  extractionStatus: resume.extractionStatus,
  isActive: resume.isActive,
  uploadDate: resume.uploadDate,
  createdAt: resume.createdAt,
  updatedAt: resume.updatedAt,
  latestAnalysis: analysis ? formatAnalysis(analysis) : null,
});

const getOwnedResume = async (resumeId, userId, includeStoredName = false) => {
  if (!mongoose.isValidObjectId(resumeId)) {
    throw createHttpError(400, "Invalid resume ID");
  }

  const query = Resume.findById(resumeId);
  if (includeStoredName) query.select("+storedFileName");
  const resume = await query;

  if (!resume) throw createHttpError(404, "Resume not found");
  if (!resume.user.equals(userId)) {
    throw createHttpError(403, "You do not have access to this resume");
  }
  return resume;
};

const activateMostRecentResume = async (userId) => {
  const resume = await Resume.findOne({ user: userId }).sort({ createdAt: -1 });
  if (resume) {
    resume.isActive = true;
    await resume.save();
  }
};

const ensureResumeVersions = async (userId) => {
  const resumes = await Resume.find({ user: userId }).select("version").sort({ createdAt: 1 }).lean();
  const used = new Set(resumes.map((resume) => resume.version).filter(Number.isInteger)); let next = 1; const operations = [];
  resumes.forEach((resume) => {
    if (Number.isInteger(resume.version)) return;
    while (used.has(next)) next += 1;
    operations.push({ updateOne: { filter: { _id: resume._id, version: { $exists: false } }, update: { $set: { version: next } } } });
    used.add(next); next += 1;
  });
  if (operations.length) await Resume.bulkWrite(operations);
};

export const uploadResume = async (req, res, next) => {
  if (!req.file) return next(createHttpError(400, "Please select a PDF resume"));

  let createdResume;
  try {
    const checksum = await calculateResumeChecksum(req.file.path);
    const duplicate = await Resume.findOne({ user: req.user._id, checksum });
    if (duplicate) {
      await deleteStoredResume(req.file.filename);
      await Resume.updateMany(
        { user: req.user._id, _id: { $ne: duplicate._id }, isActive: true },
        { $set: { isActive: false } },
      );
      duplicate.isActive = true;
      await duplicate.save();
      const analysis = await ResumeAnalysis.findOne({
        user: req.user._id,
        resume: duplicate._id,
      }).sort({ analyzedAt: -1 });
      return sendSuccess(res, 200, "This resume is already uploaded and is now active", {
        resume: formatResume(duplicate, analysis),
      });
    }

    const extractedText = await parseResumePdf(req.file.path);
    const summary = analyzeResume(extractedText);
    await ensureResumeVersions(req.user._id);
    const latestVersion = await Resume.findOne({ user: req.user._id, version: { $exists: true } }).sort({ version: -1 }).select("version").lean();
    createdResume = await Resume.create({
      user: req.user._id,
      originalFileName: path.basename(req.file.originalname),
      storedFileName: req.file.filename,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      checksum,
      extractedText,
      summary,
      version: (latestVersion?.version || await Resume.countDocuments({ user: req.user._id })) + 1,
      extractionStatus: "ready",
      isActive: false,
    });

    await Resume.updateMany(
      { user: req.user._id, _id: { $ne: createdResume._id }, isActive: true },
      { $set: { isActive: false } },
    );
    createdResume.isActive = true;
    await createdResume.save();
    const { analysis } = await createBaselineResumeAnalysis(createdResume);
    invalidateAnalyticsCache(req.user._id.toString());
    const isFirstResume = (await Resume.countDocuments({ user: req.user._id })) === 1;
    void recordActivitySafe({
      user: req.user._id, eventKey: `resume:${createdResume._id}:uploaded`, type: "resume_uploaded",
      title: "Resume uploaded", description: createdResume.originalFileName,
      relatedEntityType: "resume", relatedEntityId: createdResume._id,
      metadata: {}, xpAwarded: isFirstResume ? 50 : 0, occurredAt: createdResume.uploadDate,
    });

    return sendSuccess(res, 201, "Resume uploaded and analyzed successfully", {
      resume: formatResume(createdResume, analysis),
    });
  } catch (error) {
    if (createdResume) {
      await ResumeAnalysis.deleteMany({ resume: createdResume._id }).catch(() => {});
      await Resume.deleteOne({ _id: createdResume._id }).catch(() => {});
    }
    await deleteStoredResume(req.file.filename).catch(() => {});
    if (error.code === 11000) {
      return next(createHttpError(409, "This resume has already been uploaded"));
    }
    return next(error);
  }
};

export const getResumes = async (req, res) => {
  await ensureResumeVersions(req.user._id);
  const resumes = await Resume.find({ user: req.user._id }).sort({
    isActive: -1,
    createdAt: -1,
  });
  const analyses = await latestAnalysisByResumeIds(req.user._id, resumes.map((resume) => resume._id));
  return sendSuccess(res, 200, "Resumes fetched successfully", {
    resumes: resumes.map((resume) => formatResume(resume, analyses.get(resume._id.toString()))),
  });
};

export const getResumeById = async (req, res) => {
  const resume = await getOwnedResume(req.params.id, req.user._id);
  return sendSuccess(res, 200, "Resume fetched successfully", {
    resume: formatResume(resume),
  });
};

export const setActiveResume = async (req, res) => {
  const resume = await getOwnedResume(req.params.id, req.user._id);
  await Resume.updateMany(
    { user: req.user._id, _id: { $ne: resume._id }, isActive: true },
    { $set: { isActive: false } },
  );
  resume.isActive = true;
  await resume.save();
  invalidateAnalyticsCache(req.user._id.toString());

  return sendSuccess(res, 200, "Active resume updated successfully", {
    resume: formatResume(resume),
  });
};

export const deleteResume = async (req, res) => {
  const resume = await getOwnedResume(req.params.id, req.user._id, true);
  const wasActive = resume.isActive;

  await deleteStoredResume(resume.storedFileName);
  await ResumeAnalysis.deleteMany({ user: req.user._id, resume: resume._id });
  await resume.deleteOne();
  if (wasActive) await activateMostRecentResume(req.user._id);
  invalidateAnalyticsCache(req.user._id.toString());

  return sendSuccess(res, 200, "Resume deleted successfully", {
    id: resume._id,
  });
};

const requestedResumeId = async (req) => {
  const provided = req.query?.resumeId || req.body?.resumeId;
  if (provided) return provided;
  const active = await Resume.findOne({ user: req.user._id, isActive: true }).select("_id");
  if (!active) throw createHttpError(404, "Upload or select a resume first");
  return active._id;
};

export const getResumeHistory = getResumes;

export const getResumeAnalysis = async (req, res) => {
  const input = req.method === "POST" ? req.body : req.query;
  const { resume, analysis } = await getOrCreateResumeAnalysis({
    resumeId: await requestedResumeId(req), userId: req.user._id,
    criteria: { targetRole: input?.targetRole, jobDescription: req.method === "POST" ? input?.jobDescription : "" },
  });
  return sendSuccess(res, 200, "ATS resume analysis fetched successfully", { resume: formatResume(resume), analysis: formatAnalysis(analysis) });
};

export const improveResume = async (req, res) => {
  const { resume, analysis, criteria } = await getOrCreateResumeAnalysis({
    resumeId: await requestedResumeId(req), userId: req.user._id,
    criteria: { targetRole: req.body?.targetRole, jobDescription: req.body?.jobDescription },
  });
  const suggestions = await generateResumeImprovements({ resume, analysis, ...criteria });
  analysis.aiSuggestions = suggestions; analysis.analyzedAt = new Date(); await analysis.save();
  return sendSuccess(res, 200, "AI resume improvements generated successfully", { resume: formatResume(resume), analysis: formatAnalysis(analysis) });
};

export const compareResumes = async (req, res) => {
  const resumeIds = req.body?.resumeIds;
  if (!Array.isArray(resumeIds) || resumeIds.length < 2 || resumeIds.length > 4 || new Set(resumeIds).size !== resumeIds.length) throw createHttpError(400, "Select 2 to 4 unique resume versions");
  const criteria = { targetRole: req.body?.targetRole, jobDescription: req.body?.jobDescription };
  const results = await Promise.all(resumeIds.map((resumeId) => getOrCreateResumeAnalysis({ resumeId, userId: req.user._id, criteria })));
  const versions = results.map(({ resume, analysis }) => ({ resume: formatResume(resume), analysis: formatAnalysis(analysis) }));
  const baseline = versions[0].analysis.scores;
  const comparison = versions.map((item) => ({
    resumeId: item.resume.id, version: item.resume.version, fileName: item.resume.originalFileName, scores: item.analysis.scores,
    changeFromFirst: Object.fromEntries(Object.entries(item.analysis.scores).map(([key, value]) => [key, value - baseline[key]])),
  }));
  const recommended = [...comparison].sort((a, b) => b.scores.ats - a.scores.ats || b.scores.resume - a.scores.resume)[0];
  return sendSuccess(res, 200, "Resume versions compared successfully", { comparison, recommendedResumeId: recommended.resumeId });
};

export const exportResumeAnalysis = async (req, res) => {
  const { resume, analysis } = await getOrCreateResumeAnalysis({
    resumeId: await requestedResumeId(req), userId: req.user._id,
    criteria: { targetRole: req.body?.targetRole, jobDescription: req.body?.jobDescription },
  });
  const file = createResumeExport(req.body?.format || "pdf", resume, analysis);
  return sendSuccess(res, 200, "ATS resume report generated successfully", { filename: file.filename, mimeType: file.mimeType, contentBase64: file.buffer.toString("base64") });
};
