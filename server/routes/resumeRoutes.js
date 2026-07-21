import express from "express";
import {
  deleteResume,
  getResumeById,
  getResumes,
  setActiveResume,
  uploadResume,
} from "../controllers/resumeController.js";
import protect from "../middleware/authMiddleware.js";
import resumeUpload from "../middleware/resumeUpload.js";
import { objectIdValidation } from "../middleware/validationMiddleware.js";

const router = express.Router();

router.use(protect);
router.route("/").post(resumeUpload, uploadResume).get(getResumes);
router.patch("/:id/active", objectIdValidation, setActiveResume);
router.route("/:id").get(objectIdValidation, getResumeById).delete(objectIdValidation, deleteResume);

export default router;
