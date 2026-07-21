import UserActivity from "../../models/UserActivity.js";
import UserBadge from "../../models/UserBadge.js";
import UserProgress from "../../models/UserProgress.js";
import { calculateStreak, toDateKey } from "./dateUtils.js";

export const BADGES = [
  { key: "first_interview", name: "First Interview", description: "Complete your first interview", icon: "01", target: 1, metric: "completed" },
  { key: "five_interviews", name: "Five Interviews", description: "Complete five interviews", icon: "05", target: 5, metric: "completed" },
  { key: "ten_interviews", name: "Ten Interviews", description: "Complete ten interviews", icon: "10", target: 10, metric: "completed" },
  { key: "score_80", name: "First 80+ Score", description: "Score at least 80%", icon: "80", target: 80, metric: "highestScore" },
  { key: "score_90", name: "First 90+ Score", description: "Score at least 90%", icon: "90", target: 90, metric: "highestScore" },
  { key: "resume_ready", name: "Resume Ready", description: "Upload your first resume", icon: "CV", target: 1, metric: "resumes" },
  { key: "voice_complete", name: "Voice Interview", description: "Complete a voice interview", icon: "VO", target: 1, metric: "voiceCompleted" },
  { key: "seven_day_streak", name: "Seven-Day Streak", description: "Practice seven days in a row", icon: "7D", target: 7, metric: "longestStreak" },
];

export const levelForXp = (xp) => Math.floor(xp / 250) + 1;

export const synchronizeProgress = async (userId, metrics, timezone) => {
  const [totals = {}, activeDates] = await Promise.all([
    UserActivity.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, xp: { $sum: "$xpAwarded" } } },
    ]).then((items) => items[0] || {}),
    UserActivity.find({
      user: userId,
      type: { $in: ["question_answered", "interview_completed", "evaluation_generated", "daily_goal_completed"] },
    }).select("occurredAt").lean(),
  ]);
  const todayKey = toDateKey(new Date(), timezone);
  const streak = calculateStreak(activeDates.map((item) => toDateKey(item.occurredAt, timezone)), todayKey);
  const xp = totals.xp || 0;
  const level = levelForXp(xp);
  const progress = await UserProgress.findOneAndUpdate(
    { user: userId },
    { $set: {
      xp, level, currentStreak: streak.current, longestStreak: streak.longest,
      lastActiveDate: activeDates.length ? [...activeDates].sort((a, b) => b.occurredAt - a.occurredAt)[0] && toDateKey([...activeDates].sort((a, b) => b.occurredAt - a.occurredAt)[0].occurredAt, timezone) : null,
      questionsAnswered: metrics.questionsAnswered,
      totalPracticeMinutes: metrics.totalPracticeMinutes,
    } },
    { upsert: true, returnDocument: "after" },
  ).lean();
  return { progress, activeToday: streak.activeToday };
};

export const synchronizeBadges = async (userId, metrics) => {
  const earnedDefinitions = BADGES.filter((badge) => (metrics[badge.metric] || 0) >= badge.target);
  if (earnedDefinitions.length) {
    await UserBadge.bulkWrite(earnedDefinitions.map((badge) => ({
      updateOne: {
        filter: { user: userId, badgeKey: badge.key },
        update: { $setOnInsert: { user: userId, badgeKey: badge.key, earnedAt: new Date() } },
        upsert: true,
      },
    })), { ordered: false });
    await UserActivity.bulkWrite(earnedDefinitions.map((badge) => ({
      updateOne: {
        filter: { user: userId, eventKey: `badge:${badge.key}:earned` },
        update: { $setOnInsert: {
          user: userId, eventKey: `badge:${badge.key}:earned`, type: "badge_earned",
          title: "Badge unlocked", description: badge.name,
          relatedEntityType: "badge", metadata: {}, xpAwarded: 0, occurredAt: new Date(),
        } },
        upsert: true,
      },
    })), { ordered: false });
  }
  const earned = await UserBadge.find({ user: userId }).lean();
  const earnedMap = new Map(earned.map((item) => [item.badgeKey, item]));
  return BADGES.map((badge) => ({
    ...badge,
    earned: earnedMap.has(badge.key),
    earnedAt: earnedMap.get(badge.key)?.earnedAt || null,
    progress: Math.min(metrics[badge.metric] || 0, badge.target),
  }));
};
