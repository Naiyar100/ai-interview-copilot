import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  createScheduledInterview,
  deleteScheduledInterview,
  getScheduledInterviews,
  updateScheduledInterview,
} from "../controllers/scheduledInterviewController.js";
import { objectIdValidation, scheduleCreateValidation, scheduleUpdateValidation } from "../middleware/validationMiddleware.js";

const router = express.Router();
router.use(protect);
router.route("/").get(getScheduledInterviews).post(scheduleCreateValidation, createScheduledInterview);
router.route("/:id").put(objectIdValidation, scheduleUpdateValidation, updateScheduledInterview).delete(objectIdValidation, deleteScheduledInterview);
export default router;
