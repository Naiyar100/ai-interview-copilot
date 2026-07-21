import express from "express";
import { rateLimit } from "express-rate-limit";
import protect from "../middleware/authMiddleware.js";
import { compareInterviews, createSavedView, deleteSavedView, exportAnalytics, getAnalyticsOverview, listSavedViews, updateSavedView } from "../controllers/analyticsController.js";

const router = express.Router();
const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 1000 : 10,
  standardHeaders: "draft-8", legacyHeaders: false,
  handler: (req, res, next) => { void req; void res; const error = new Error("Too many analytics exports. Please try again later."); error.statusCode = 429; next(error); },
});

router.use(protect);
router.get("/overview", getAnalyticsOverview);
router.post("/compare", compareInterviews);
router.post("/export", exportLimiter, exportAnalytics);
router.route("/views").get(listSavedViews).post(createSavedView);
router.route("/views/:id").put(updateSavedView).delete(deleteSavedView);

export default router;
