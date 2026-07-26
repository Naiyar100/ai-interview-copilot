import express from "express";
import {
  claimChallengeReward,
  getBadgeList,
  getChallengeList,
  getHistory,
  getInternalLeaderboard,
  getProfile,
} from "../controllers/gamificationController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/profile", getProfile);
router.get("/challenges", getChallengeList);
router.post("/challenges/:challengeKey/claim", claimChallengeReward);
router.get("/badges", getBadgeList);
router.get("/history", getHistory);
router.get("/leaderboard", getInternalLeaderboard);

export default router;
