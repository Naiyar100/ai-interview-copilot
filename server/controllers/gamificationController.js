import { sendSuccess } from "../utils/apiResponse.js";
import {
  XP_RULES,
  claimChallenge,
  getBadges,
  getChallenges,
  getGamificationProfile,
  getLeaderboard,
  getRewardHistory,
} from "../services/gamificationService.js";

export const getProfile = async (req, res) =>
  sendSuccess(res, 200, "Gamification profile fetched successfully", {
    profile: await getGamificationProfile(req.user._id),
    xpRules: XP_RULES,
  });

export const getChallengeList = async (req, res) =>
  sendSuccess(res, 200, "Challenges fetched successfully", {
    challenges: await getChallenges(req.user._id),
  });

export const claimChallengeReward = async (req, res) =>
  sendSuccess(
    res,
    200,
    "Challenge reward claimed successfully",
    await claimChallenge(req.user._id, req.params.challengeKey),
  );

export const getBadgeList = async (req, res) =>
  sendSuccess(res, 200, "Badges fetched successfully", {
    badges: await getBadges(req.user._id),
  });

export const getHistory = async (req, res) =>
  sendSuccess(res, 200, "Reward history fetched successfully", {
    history: await getRewardHistory(req.user._id, req.query.limit),
  });

export const getInternalLeaderboard = async (req, res) =>
  sendSuccess(res, 200, "Leaderboard fetched successfully", {
    leaderboard: await getLeaderboard(req.user._id),
  });
