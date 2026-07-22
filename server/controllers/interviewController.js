import mongoose from "mongoose";
import Interview from "../models/Interview.js";
import Resume from "../models/Resume.js";
import { generateInterviewQuestions as generateQuestions } from "../services/ai/geminiService.js";
import { buildResumeContext } from "../services/resume/analyzer.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { recordActivitySafe } from "../services/dashboard/activityService.js";
import { invalidateAnalyticsCache } from "../services/analytics/cacheService.js";

const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const INTERVIEW_TYPES = ["Technical", "Behavioral", "Mixed"];
const STATUSES = ["draft", "completed"];
const SORT_FIELDS = ["createdAt", "completedAt", "role", "difficulty", "status"];

const createHttpError = (statusCode, message, errors = []) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errors = errors;
  return error;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatInterview = (interview) => ({
  id: interview._id,
  role: interview.role,
  experienceLevel: interview.experienceLevel,
  difficulty: interview.difficulty,
  interviewType: interview.interviewType,
  resumeId: interview.resume,
  resumeBased: Boolean(interview.resumeSummary),
  questions: interview.questions,
  questionDetails: interview.generatedQuestions,
  answers: interview.answers,
  transcripts: interview.transcripts || [],
  voiceMetadata: interview.voiceMetadata,
  aiFeedback: interview.aiFeedback,
  score: interview.score,
  evaluationCount: interview.evaluations?.length || 0,
  latestEvaluationId: interview.evaluations?.at(-1)?._id || null,
  evaluatedAt: interview.evaluations?.at(-1)?.evaluatedAt || null,
  status: interview.status,
  duration: interview.duration,
  totalQuestions: interview.totalQuestions || interview.questions.length,
  answeredQuestions: interview.answers.filter((answer) => answer?.trim()).length,
  startedAt: interview.startedAt,
  completedAt: interview.completedAt,
  createdAt: interview.createdAt,
  updatedAt: interview.updatedAt,
});

const validateCreateInput = ({
  role,
  experienceLevel,
  difficulty,
  interviewType,
  questionCount,
}) => {
  const errors = [];

  if (typeof role !== "string" || !role.trim()) errors.push("role is required");
  if (typeof experienceLevel !== "string" || !experienceLevel.trim()) {
    errors.push("experienceLevel is required");
  }
  if (!DIFFICULTIES.includes(difficulty)) errors.push("difficulty is invalid");
  if (!INTERVIEW_TYPES.includes(interviewType)) {
    errors.push("interviewType is invalid");
  }
  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 20) {
    errors.push("questionCount must be an integer between 1 and 20");
  }

  return errors;
};

const getOwnedInterview = async (interviewId, userId) => {
  if (!mongoose.isValidObjectId(interviewId)) {
    throw createHttpError(400, "Invalid interview ID");
  }

  const interview = await Interview.findById(interviewId);

  if (!interview) {
    throw createHttpError(404, "Interview not found");
  }

  if (!interview.user.equals(userId)) {
    throw createHttpError(403, "You do not have access to this interview");
  }

  return interview;
};

const mergeTextEntries = (currentEntries, updates, questionCount, fieldName) => {
  if (!Array.isArray(updates)) {
    throw createHttpError(400, `${fieldName} must be an array`);
  }

  if (updates.length > questionCount) {
    throw createHttpError(400, `${fieldName} cannot exceed the number of questions`);
  }

  const mergedAnswers = Array.from(
    { length: questionCount },
    (_, index) => currentEntries[index] || "",
  );

  updates.forEach((entry, index) => {
    if (entry !== null && entry !== undefined) {
      if (typeof entry !== "string") {
        throw createHttpError(400, `every ${fieldName.slice(0, -1)} must be a string`);
      }
      mergedAnswers[index] = entry;
    }
  });

  return mergedAnswers;
};

const mergeVoiceMetadata = (currentMetadata, updates) => {
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    throw createHttpError(400, "voiceMetadata must be an object");
  }
  const metadata = currentMetadata?.toObject?.() || currentMetadata || {};
  if (updates.mode !== undefined && !["text", "voice"].includes(updates.mode)) {
    throw createHttpError(400, "voice mode is invalid");
  }
  if (
    updates.language !== undefined &&
    (typeof updates.language !== "string" || !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(updates.language))
  ) {
    throw createHttpError(400, "voice language is invalid");
  }
  if (
    updates.speakingRate !== undefined &&
    (typeof updates.speakingRate !== "number" || updates.speakingRate < 0.5 || updates.speakingRate > 2)
  ) {
    throw createHttpError(400, "speakingRate must be between 0.5 and 2");
  }
  for (const field of ["muted", "autoPlayQuestions"]) {
    if (updates[field] !== undefined && typeof updates[field] !== "boolean") {
      throw createHttpError(400, `${field} must be a boolean`);
    }
  }
  if (
    updates.recordingAttempts !== undefined &&
    (!Number.isInteger(updates.recordingAttempts) || updates.recordingAttempts < 0)
  ) {
    throw createHttpError(400, "recordingAttempts must be a non-negative integer");
  }
  if (updates.lastRecordedAt !== undefined && updates.lastRecordedAt !== null) {
    const lastRecordedAt = new Date(updates.lastRecordedAt);
    if (Number.isNaN(lastRecordedAt.getTime())) {
      throw createHttpError(400, "lastRecordedAt must be a valid date");
    }
    updates = { ...updates, lastRecordedAt };
  }
  const allowedFields = [
    "mode", "language", "speakingRate", "muted", "autoPlayQuestions",
    "recordingAttempts", "lastRecordedAt",
  ];
  return allowedFields.reduce(
    (result, field) => updates[field] === undefined ? result : { ...result, [field]: updates[field] },
    metadata,
  );
};

export const createInterview = async (req, res, next) => {
  const { role, experienceLevel, difficulty, interviewType, questionCount } = req.body;
  const errors = validateCreateInput(req.body);

  if (errors.length) {
    return next(createHttpError(400, "Please provide valid interview details", errors));
  }

  const activeResume = await Resume.findOne({
    user: req.user._id,
    isActive: true,
  });
  const interview = await Interview.create({
    user: req.user._id,
    role: role.trim(),
    experienceLevel: experienceLevel.trim(),
    difficulty,
    interviewType,
    ...(activeResume
      ? { resume: activeResume._id, resumeSummary: activeResume.summary.toObject() }
      : {}),
    questions: [],
    answers: [],
    transcripts: [],
    totalQuestions: questionCount,
    answeredQuestions: 0,
    status: "draft",
  });
  invalidateAnalyticsCache(req.user._id.toString());
  void recordActivitySafe({
    user: req.user._id, eventKey: `interview:${interview._id}:created`, type: "interview_created",
    title: "Interview created", description: `${interview.role} practice started`,
    relatedEntityType: "interview", relatedEntityId: interview._id,
    metadata: { role: interview.role, difficulty: interview.difficulty }, xpAwarded: 10, occurredAt: interview.createdAt,
  });

  return sendSuccess(res, 201, "Interview created successfully", {
    interview: formatInterview(interview),
  });
};

const createGenerationInput = (interview) => ({
  role: interview.role,
  experienceLevel: interview.experienceLevel,
  difficulty: interview.difficulty,
  interviewType: interview.interviewType,
  numberOfQuestions: interview.totalQuestions,
  skills: interview.resumeSummary?.skills || [],
  resumeSummary: interview.resumeSummary
    ? buildResumeContext(interview.resumeSummary)
    : "",
});

const hasSavedAnswers = (interview) =>
  interview.answers.some((answer) => typeof answer === "string" && answer.trim());

const saveGeneratedQuestions = async (interview, generatedQuestions) => {
  interview.generatedQuestions = generatedQuestions;
  interview.questions = generatedQuestions.map((item) => item.question);
  interview.answers = Array(generatedQuestions.length).fill("");
  interview.transcripts = Array(generatedQuestions.length).fill("");
  interview.answeredQuestions = 0;
  interview.questionsGeneratedAt = new Date();
  await interview.save();
  invalidateAnalyticsCache(interview.user.toString());
};

export const generateInterviewQuestions = async (req, res, next) => {
  const interview = await getOwnedInterview(req.params.id, req.user._id);

  if (interview.status === "completed") {
    return next(createHttpError(400, "Completed interviews cannot generate questions"));
  }
  if (interview.questions.length) {
    return next(createHttpError(409, "Questions have already been generated"));
  }

  const generatedQuestions = await generateQuestions(createGenerationInput(interview));
  await saveGeneratedQuestions(interview, generatedQuestions);

  return sendSuccess(res, 200, "Interview questions generated successfully", {
    questions: generatedQuestions,
    interview: formatInterview(interview),
  });
};

export const regenerateInterviewQuestions = async (req, res, next) => {
  const interview = await getOwnedInterview(req.params.id, req.user._id);

  if (interview.status === "completed") {
    return next(createHttpError(400, "Completed interviews cannot regenerate questions"));
  }
  if (hasSavedAnswers(interview) && req.body?.confirmAnswerReset !== true) {
    return next(
      createHttpError(
        409,
        "Regenerating questions requires confirmation because saved answers will be removed",
      ),
    );
  }

  const generatedQuestions = await generateQuestions(createGenerationInput(interview));
  await saveGeneratedQuestions(interview, generatedQuestions);

  return sendSuccess(res, 200, "Interview questions regenerated successfully", {
    questions: generatedQuestions,
    interview: formatInterview(interview),
  });
};

export const getInterviews = async (req, res, next) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 50);
  const filter = { user: req.user._id };

  if (req.query.difficulty) {
    if (!DIFFICULTIES.includes(req.query.difficulty)) {
      return next(createHttpError(400, "Invalid difficulty filter"));
    }
    filter.difficulty = req.query.difficulty;
  }

  if (req.query.status) {
    if (!STATUSES.includes(req.query.status)) {
      return next(createHttpError(400, "Invalid status filter"));
    }
    filter.status = req.query.status;
  }

  if (req.query.role) {
    filter.role = new RegExp(`^${escapeRegExp(req.query.role.trim())}$`, "i");
  }

  if (req.query.date) {
    const startDate = new Date(`${req.query.date}T00:00:00.000Z`);
    if (Number.isNaN(startDate.getTime())) {
      return next(createHttpError(400, "Invalid date filter"));
    }
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    filter.createdAt = { $gte: startDate, $lt: endDate };
  }

  if (req.query.search?.trim()) {
    const search = new RegExp(escapeRegExp(req.query.search.trim()), "i");
    filter.$or = [{ role: search }, { interviewType: search }];
  }

  const sortBy = SORT_FIELDS.includes(req.query.sortBy) ? req.query.sortBy : "createdAt";
  const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
  const [interviews, totalItems] = await Promise.all([
    Interview.find(filter)
      .sort({ [sortBy]: sortOrder, _id: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Interview.countDocuments(filter),
  ]);

  return sendSuccess(res, 200, "Interviews fetched successfully", {
    interviews: interviews.map(formatInterview),
    totalPages: Math.ceil(totalItems / limit),
    currentPage: page,
    totalItems,
    limit,
  });
};

export const getInterviewById = async (req, res) => {
  const interview = await getOwnedInterview(req.params.id, req.user._id);
  return sendSuccess(res, 200, "Interview fetched successfully", {
    interview: formatInterview(interview),
  });
};

export const updateInterview = async (req, res, next) => {
  const interview = await getOwnedInterview(req.params.id, req.user._id);

  if (interview.status === "completed") {
    return next(createHttpError(400, "Completed interviews cannot be updated"));
  }

  if (
    req.body.role !== undefined &&
    (typeof req.body.role !== "string" || !req.body.role.trim())
  ) {
    return next(createHttpError(400, "role must be a non-empty string"));
  }
  if (
    req.body.experienceLevel !== undefined &&
    (typeof req.body.experienceLevel !== "string" ||
      !req.body.experienceLevel.trim())
  ) {
    return next(
      createHttpError(400, "experienceLevel must be a non-empty string"),
    );
  }
  if (
    req.body.difficulty !== undefined &&
    !DIFFICULTIES.includes(req.body.difficulty)
  ) {
    return next(createHttpError(400, "difficulty is invalid"));
  }
  if (
    req.body.interviewType !== undefined &&
    !INTERVIEW_TYPES.includes(req.body.interviewType)
  ) {
    return next(createHttpError(400, "interviewType is invalid"));
  }

  if (req.body.role !== undefined) interview.role = req.body.role.trim();
  if (req.body.experienceLevel !== undefined) {
    interview.experienceLevel = req.body.experienceLevel.trim();
  }
  if (req.body.difficulty !== undefined) interview.difficulty = req.body.difficulty;
  if (req.body.interviewType !== undefined) {
    interview.interviewType = req.body.interviewType;
  }
  if (req.body.answers !== undefined) {
    interview.answers = mergeTextEntries(
      interview.answers,
      req.body.answers,
      interview.questions.length,
      "answers",
    );
    interview.answeredQuestions = interview.answers.filter((answer) => answer.trim()).length;
  }
  if (req.body.transcripts !== undefined) {
    interview.transcripts = mergeTextEntries(
      interview.transcripts,
      req.body.transcripts,
      interview.questions.length,
      "transcripts",
    );
  }
  if (req.body.voiceMetadata !== undefined) {
    interview.voiceMetadata = mergeVoiceMetadata(
      interview.voiceMetadata,
      req.body.voiceMetadata,
    );
  }

  await interview.save();
  invalidateAnalyticsCache(req.user._id.toString());

  interview.answers.forEach((answer, index) => {
    if (!answer?.trim()) return;
    void recordActivitySafe({
      user: req.user._id, eventKey: `interview:${interview._id}:question:${index + 1}`, type: "question_answered",
      title: "Interview question answered", description: interview.role,
      relatedEntityType: "interview", relatedEntityId: interview._id,
      metadata: { role: interview.role, count: 1 }, xpAwarded: 5, occurredAt: new Date(),
    });
  });

  return sendSuccess(res, 200, "Interview updated successfully", {
    interview: formatInterview(interview),
  });
};

export const completeInterview = async (req, res, next) => {
  const interview = await getOwnedInterview(req.params.id, req.user._id);

  if (interview.status === "completed") {
    return next(createHttpError(400, "Interview is already completed"));
  }
  if (!interview.questions.length) {
    return next(createHttpError(409, "Generate interview questions before completing"));
  }

  if (req.body.answers !== undefined) {
    interview.answers = mergeTextEntries(
      interview.answers,
      req.body.answers,
      interview.questions.length,
      "answers",
    );
  }
  if (req.body.transcripts !== undefined) {
    interview.transcripts = mergeTextEntries(
      interview.transcripts,
      req.body.transcripts,
      interview.questions.length,
      "transcripts",
    );
  }
  if (req.body.voiceMetadata !== undefined) {
    interview.voiceMetadata = mergeVoiceMetadata(
      interview.voiceMetadata,
      req.body.voiceMetadata,
    );
  }

  const completedAt = new Date();
  interview.status = "completed";
  interview.completedAt = completedAt;
  interview.duration = Math.max(
    Math.round((completedAt.getTime() - interview.startedAt.getTime()) / 1000),
    0,
  );
  interview.answeredQuestions = interview.answers.filter((answer) => answer.trim()).length;
  await interview.save();
  invalidateAnalyticsCache(req.user._id.toString());

  void recordActivitySafe({
    user: req.user._id, eventKey: `interview:${interview._id}:completed`, type: "interview_completed",
    title: "Interview completed", description: interview.role,
    relatedEntityType: "interview", relatedEntityId: interview._id,
    metadata: { role: interview.role, score: interview.score, durationMinutes: Math.round(interview.duration / 60) },
    xpAwarded: 50, occurredAt: interview.completedAt,
  });
  if (interview.voiceMetadata?.mode === "voice") {
    void recordActivitySafe({
      user: req.user._id, eventKey: "user:voice:first", type: "voice_interview_completed",
      title: "First voice interview completed", description: interview.role,
      relatedEntityType: "interview", relatedEntityId: interview._id,
      metadata: { role: interview.role }, xpAwarded: 40, occurredAt: interview.completedAt,
    });
  }

  return sendSuccess(res, 200, "Interview completed successfully", {
    interview: formatInterview(interview),
  });
};

export const deleteInterview = async (req, res) => {
  const interview = await getOwnedInterview(req.params.id, req.user._id);
  await interview.deleteOne();
  invalidateAnalyticsCache(req.user._id.toString());

  return sendSuccess(res, 200, "Interview deleted successfully", {
    id: interview._id,
  });
};
