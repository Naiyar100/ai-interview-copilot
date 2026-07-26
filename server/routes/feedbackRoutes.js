import express from "express";
import { submitFeedback } from "../controllers/feedbackController.js";
import protect from "../middleware/authMiddleware.js";
import { feedbackValidation } from "../middleware/validationMiddleware.js";

const router = express.Router();

router.post("/", protect, feedbackValidation, submitFeedback);

export default router;
