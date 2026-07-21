import express from "express";
import {
  completeInterview,
  createInterview,
  deleteInterview,
  getInterviewById,
  getInterviews,
  generateInterviewQuestions,
  regenerateInterviewQuestions,
  updateInterview,
} from "../controllers/interviewController.js";
import protect from "../middleware/authMiddleware.js";
import generationRateLimit from "../middleware/generationRateLimit.js";
import {
  evaluateInterview,
  getInterviewEvaluationById,
  getInterviewEvaluations,
  reevaluateInterview,
} from "../controllers/evaluationController.js";
import {
  evaluationIdValidation,
  interviewCreateValidation,
  interviewListValidation,
  objectIdValidation,
  reevaluationValidation,
} from "../middleware/validationMiddleware.js";

const router = express.Router();

router.use(protect);
router.route("/").post(interviewCreateValidation, createInterview).get(interviewListValidation, getInterviews);
router.post("/:id/generate", objectIdValidation, generationRateLimit, generateInterviewQuestions);
router.post("/:id/regenerate", objectIdValidation, generationRateLimit, regenerateInterviewQuestions);
router.post("/:id/evaluate", objectIdValidation, generationRateLimit, evaluateInterview);
router.post("/:id/re-evaluate", reevaluationValidation, generationRateLimit, reevaluateInterview);
router.get("/:id/evaluations", objectIdValidation, getInterviewEvaluations);
router.get("/:id/evaluations/:evaluationId", evaluationIdValidation, getInterviewEvaluationById);
router.patch("/:id/complete", objectIdValidation, completeInterview);
router
  .route("/:id")
  .get(objectIdValidation, getInterviewById)
  .put(objectIdValidation, updateInterview)
  .delete(objectIdValidation, deleteInterview);

export default router;
