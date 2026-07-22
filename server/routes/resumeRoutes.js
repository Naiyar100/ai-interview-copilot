import express from "express";
import {
  deleteResume,
  compareResumes,
  exportResumeAnalysis,
  getResumeAnalysis,
  getResumeHistory,
  getResumeById,
  getResumes,
  setActiveResume,
  improveResume,
  uploadResume,
} from "../controllers/resumeController.js";
import protect from "../middleware/authMiddleware.js";
import generationRateLimit from "../middleware/generationRateLimit.js";
import resumeUpload from "../middleware/resumeUpload.js";
import { objectIdValidation } from "../middleware/validationMiddleware.js";

const router = express.Router();

router.use(protect);
router.route("/").post(resumeUpload, uploadResume).get(getResumes);
router.post("/upload", resumeUpload, uploadResume);
router.get("/history", getResumeHistory);
router.route("/analysis").get(getResumeAnalysis).post(getResumeAnalysis);
router.post("/compare", compareResumes);
router.post("/improve", generationRateLimit, improveResume);
router.post("/export", exportResumeAnalysis);
router.patch("/:id/active", objectIdValidation, setActiveResume);
router.route("/:id").get(objectIdValidation, getResumeById).delete(objectIdValidation, deleteResume);

export default router;
