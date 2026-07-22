import { sendSuccess } from "../utils/apiResponse.js";
import { invalidateAnalyticsCache } from "../services/analytics/cacheService.js";
import {
  buildDashboardOverview,
  getActivityPage,
  getBadgeOverview,
  getOrCreateGoal,
  updateGoal,
} from "../services/dashboard/dashboardService.js";

const timezoneFrom = (req) => req.query.timezone || req.body?.timezone || "UTC";

export const getDashboardOverview = async (req, res) =>
  sendSuccess(res, 200, "Dashboard overview fetched successfully", await buildDashboardOverview(req.user, timezoneFrom(req)));

export const getDashboardSummary = async (req, res) => {
  const overview = await buildDashboardOverview(req.user, timezoneFrom(req));
  return sendSuccess(res, 200, "Dashboard summary fetched successfully", {
    totalInterviews: overview.summary.totalInterviews,
    completedInterviews: overview.summary.completedInterviews,
    averageScore: overview.summary.averageScore,
    highestScore: overview.summary.highestScore,
    evaluatedInterviews: overview.summary.evaluatedInterviews,
    lastInterview: overview.recentInterviews[0]?.completedAt || overview.recentInterviews[0]?.createdAt || null,
    mostCommonRole: overview.user.targetRole,
    mostCommonDifficulty: overview.recentInterviews[0]?.difficulty || null,
    averageDuration: overview.summary.completedInterviews
      ? Math.round(overview.summary.totalPracticeMinutes / overview.summary.completedInterviews * 10) / 10
      : 0,
    recentReports: overview.recentInterviews
      .filter((item) => item.score != null)
      .slice(0, 3)
      .map((item) => ({ interviewId: item.id, role: item.role, difficulty: item.difficulty, score: item.score, evaluatedAt: item.updatedAt })),
  });
};

export const getDailyGoal = async (req, res) =>
  sendSuccess(res, 200, "Daily goal fetched successfully", { goal: await getOrCreateGoal(req.user._id, timezoneFrom(req)) });

export const updateDailyGoal = async (req, res) => {
  const goal = await updateGoal(req.user._id, req.body);
  invalidateAnalyticsCache(req.user._id.toString());
  return sendSuccess(res, 200, "Daily goal updated successfully", { goal });
};

export const getDashboardActivity = async (req, res) =>
  sendSuccess(res, 200, "Dashboard activity fetched successfully", { activity: await getActivityPage(req.user._id, req.query.limit || 30) });

export const getDashboardBadges = async (req, res) =>
  sendSuccess(res, 200, "Badge progress fetched successfully", await getBadgeOverview(req.user._id));
