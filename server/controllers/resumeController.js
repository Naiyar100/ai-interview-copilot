import path from "node:path";
import mongoose from "mongoose";
import Resume from "../models/Resume.js";
import { analyzeResume } from "../services/resume/analyzer.js";
import { parseResumePdf } from "../services/resume/parser.js";
import {
  calculateResumeChecksum,
  deleteStoredResume,
} from "../services/resume/storage.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { recordActivitySafe } from "../services/dashboard/activityService.js";
import { invalidateAnalyticsCache } from "../services/analytics/cacheService.js";

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const formatResume = (resume) => ({
  id: resume._id,
  originalFileName: resume.originalFileName,
  fileSize: resume.fileSize,
  mimeType: resume.mimeType,
  summary: resume.summary,
  extractionStatus: resume.extractionStatus,
  isActive: resume.isActive,
  uploadDate: resume.uploadDate,
  createdAt: resume.createdAt,
  updatedAt: resume.updatedAt,
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

export const uploadResume = async (req, res, next) => {
  if (!req.file) return next(createHttpError(400, "Please select a PDF resume"));

  let createdResume;
  try {
    const checksum = await calculateResumeChecksum(req.file.path);
    const duplicate = await Resume.exists({ user: req.user._id, checksum });
    if (duplicate) throw createHttpError(409, "This resume has already been uploaded");

    const extractedText = await parseResumePdf(req.file.path);
    const summary = analyzeResume(extractedText);
    createdResume = await Resume.create({
      user: req.user._id,
      originalFileName: path.basename(req.file.originalname),
      storedFileName: req.file.filename,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      checksum,
      extractedText,
      summary,
      extractionStatus: "ready",
      isActive: false,
    });

    await Resume.updateMany(
      { user: req.user._id, _id: { $ne: createdResume._id }, isActive: true },
      { $set: { isActive: false } },
    );
    createdResume.isActive = true;
    await createdResume.save();
    invalidateAnalyticsCache(req.user._id.toString());
    const isFirstResume = (await Resume.countDocuments({ user: req.user._id })) === 1;
    void recordActivitySafe({
      user: req.user._id, eventKey: `resume:${createdResume._id}:uploaded`, type: "resume_uploaded",
      title: "Resume uploaded", description: createdResume.originalFileName,
      relatedEntityType: "resume", relatedEntityId: createdResume._id,
      metadata: {}, xpAwarded: isFirstResume ? 50 : 0, occurredAt: createdResume.uploadDate,
    });

    return sendSuccess(res, 201, "Resume uploaded and analyzed successfully", {
      resume: formatResume(createdResume),
    });
  } catch (error) {
    if (createdResume) await Resume.deleteOne({ _id: createdResume._id }).catch(() => {});
    await deleteStoredResume(req.file.filename).catch(() => {});
    if (error.code === 11000) {
      return next(createHttpError(409, "This resume has already been uploaded"));
    }
    return next(error);
  }
};

export const getResumes = async (req, res) => {
  const resumes = await Resume.find({ user: req.user._id }).sort({
    isActive: -1,
    createdAt: -1,
  });
  return sendSuccess(res, 200, "Resumes fetched successfully", {
    resumes: resumes.map(formatResume),
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
  await resume.deleteOne();
  if (wasActive) await activateMostRecentResume(req.user._id);
  invalidateAnalyticsCache(req.user._id.toString());

  return sendSuccess(res, 200, "Resume deleted successfully", {
    id: resume._id,
  });
};
