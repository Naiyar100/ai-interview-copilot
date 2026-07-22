import mongoose from "mongoose";
import Interview from "../models/Interview.js";
import { evaluateInterviewAnswers } from "../services/evaluation/evaluator.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { recordActivitySafe } from "../services/dashboard/activityService.js";
import { invalidateAnalyticsCache } from "../services/analytics/cacheService.js";

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getOwnedInterview = async (interviewId, userId) => {
  if (!mongoose.isValidObjectId(interviewId)) {
    throw createHttpError(400, "Invalid interview ID");
  }
  const interview = await Interview.findById(interviewId);
  if (!interview) throw createHttpError(404, "Interview not found");
  if (!interview.user.equals(userId)) {
    throw createHttpError(403, "You do not have access to this interview");
  }
  return interview;
};

const validateEvaluationInput = (interview) => {
  if (interview.status !== "completed") {
    throw createHttpError(400, "Complete the interview before requesting evaluation");
  }
  if (!interview.questions.length) {
    throw createHttpError(400, "This interview has no questions to evaluate");
  }
  if (
    interview.answers.length < interview.questions.length ||
    interview.questions.some((question, index) => !interview.answers[index]?.trim())
  ) {
    throw createHttpError(400, "Answer every interview question before requesting evaluation");
  }
};

const formatEvaluation = (evaluation, interview) => ({
  id: evaluation._id,
  overallScore: evaluation.overallScore,
  summary: evaluation.summary,
  strengths: evaluation.strengths,
  improvements: evaluation.improvements,
  questions: evaluation.questions.map((question) => ({
    questionId: question.questionId,
    question: interview.questions[question.questionId - 1],
    answer: interview.answers[question.questionId - 1],
    score: question.score,
    feedback: question.feedback,
    idealAnswer: question.idealAnswer,
    topicsToStudy: question.topicsToStudy,
  })),
  evaluatedAt: evaluation.evaluatedAt,
});

const createAndStoreEvaluation = async (interview, replaceHistory = false) => {
  const result = await evaluateInterviewAnswers({
    role: interview.role,
    experienceLevel: interview.experienceLevel,
    difficulty: interview.difficulty,
    interviewType: interview.interviewType,
    questions: interview.questions,
    answers: interview.answers,
  });

  if (replaceHistory) interview.evaluations = [];
  interview.evaluations.push({ ...result, evaluatedAt: new Date() });
  const evaluation = interview.evaluations.at(-1);
  interview.score = result.overallScore;
  interview.aiFeedback = result;
  await interview.save();
  invalidateAnalyticsCache(interview.user.toString());
  return evaluation;
};

export const evaluateInterview = async (req, res, next) => {
  const interview = await getOwnedInterview(req.params.id, req.user._id);
  validateEvaluationInput(interview);
  if (interview.evaluations.length) {
    return next(createHttpError(409, "This interview has already been evaluated"));
  }

  const evaluation = await createAndStoreEvaluation(interview);
  void recordActivitySafe({
    user: req.user._id, eventKey: `interview:${interview._id}:evaluated`, type: "evaluation_generated",
    title: "AI evaluation generated", description: `${interview.role} · ${evaluation.overallScore}%`,
    relatedEntityType: "interview", relatedEntityId: interview._id,
    metadata: { role: interview.role, score: evaluation.overallScore },
    xpAwarded: 15 + (evaluation.overallScore >= 80 ? 25 : 0), occurredAt: evaluation.evaluatedAt,
  });
  return sendSuccess(res, 201, "Interview evaluated successfully", {
    evaluation: formatEvaluation(evaluation, interview),
  });
};

export const reevaluateInterview = async (req, res, next) => {
  const interview = await getOwnedInterview(req.params.id, req.user._id);
  validateEvaluationInput(interview);
  if (!interview.evaluations.length) {
    return next(createHttpError(400, "Evaluate this interview before re-evaluating it"));
  }

  const mode = req.body?.mode || "keep";
  if (!["keep", "replace"].includes(mode)) {
    return next(createHttpError(400, "mode must be keep or replace"));
  }
  const evaluation = await createAndStoreEvaluation(interview, mode === "replace");
  void recordActivitySafe({
    user: req.user._id, eventKey: `interview:${interview._id}:evaluation:${evaluation._id}`, type: "evaluation_generated",
    title: "AI evaluation refreshed", description: `${interview.role} · ${evaluation.overallScore}%`,
    relatedEntityType: "interview", relatedEntityId: interview._id,
    metadata: { role: interview.role, score: evaluation.overallScore }, xpAwarded: 0,
    occurredAt: evaluation.evaluatedAt,
  });
  return sendSuccess(res, 201, "Interview re-evaluated successfully", {
    evaluation: formatEvaluation(evaluation, interview),
    historyMode: mode,
  });
};

export const getInterviewEvaluations = async (req, res) => {
  const interview = await getOwnedInterview(req.params.id, req.user._id);
  return sendSuccess(res, 200, "Evaluation reports fetched successfully", {
    interview: {
      id: interview._id,
      role: interview.role,
      experienceLevel: interview.experienceLevel,
      difficulty: interview.difficulty,
      interviewType: interview.interviewType,
    },
    evaluations: [...interview.evaluations]
      .reverse()
      .map((evaluation) => formatEvaluation(evaluation, interview)),
  });
};

export const getInterviewEvaluationById = async (req, res) => {
  const interview = await getOwnedInterview(req.params.id, req.user._id);
  if (!mongoose.isValidObjectId(req.params.evaluationId)) {
    throw createHttpError(400, "Invalid evaluation ID");
  }
  const evaluation = interview.evaluations.id(req.params.evaluationId);
  if (!evaluation) throw createHttpError(404, "Evaluation report not found");

  return sendSuccess(res, 200, "Evaluation report fetched successfully", {
    evaluation: formatEvaluation(evaluation, interview),
  });
};
