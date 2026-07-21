import express from "express";
import {
  getDailyGoal,
  getDashboardActivity,
  getDashboardBadges,
  getDashboardOverview,
  getDashboardSummary,
  updateDailyGoal,
} from "../controllers/dashboardController.js";
import protect from "../middleware/authMiddleware.js";
import { activityListValidation, dashboardTimezoneValidation, goalValidation } from "../middleware/validationMiddleware.js";

const router = express.Router();

router.get("/summary", protect, getDashboardSummary);
router.get("/overview", protect, dashboardTimezoneValidation, getDashboardOverview);
router.route("/goal").get(protect, dashboardTimezoneValidation, getDailyGoal).put(protect, goalValidation, updateDailyGoal);
router.get("/activity", protect, activityListValidation, getDashboardActivity);
router.get("/badges", protect, getDashboardBadges);

export default router;
