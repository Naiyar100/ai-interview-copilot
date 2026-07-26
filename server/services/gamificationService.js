import ChallengeClaim from "../models/ChallengeClaim.js";
import Interview from "../models/Interview.js";
import Resume from "../models/Resume.js";
import User from "../models/User.js";
import UserActivity from "../models/UserActivity.js";
import {
  levelForXp,
  synchronizeBadges,
  synchronizeProgress,
} from "./dashboard/gamificationService.js";
import { formatActivity } from "./dashboard/activityService.js";
import { toDateKey } from "./dashboard/dateUtils.js";

export const XP_RULES = Object.freeze({
  interviewCreated: 10,
  questionAnswered: 5,
  interviewCompleted: 50,
  evaluationGenerated: 15,
  highScoreBonus: 25,
  dailyGoalCompleted: 30,
  firstResume: 50,
  firstVoiceInterview: 40,
});

export const CHALLENGES = Object.freeze([
  {
    key: "daily_questions",
    type: "daily",
    title: "Question Sprint",
    description: "Answer 5 interview questions today",
    metric: "questions",
    target: 5,
    xp: 25,
  },
  {
    key: "daily_interview",
    type: "daily",
    title: "Complete a Session",
    description: "Complete one interview today",
    metric: "completed",
    target: 1,
    xp: 40,
  },
  {
    key: "weekly_questions",
    type: "weekly",
    title: "Weekly Practice",
    description: "Answer 20 interview questions this week",
    metric: "questions",
    target: 20,
    xp: 100,
  },
  {
    key: "weekly_interviews",
    type: "weekly",
    title: "Interview Momentum",
    description: "Complete 3 interviews this week",
    metric: "completed",
    target: 3,
    xp: 150,
  },
  {
    key: "weekly_evaluations",
    type: "weekly",
    title: "Feedback Loop",
    description: "Generate 2 evaluations this week",
    metric: "evaluations",
    target: 2,
    xp: 100,
  },
]);

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const startOfUtcDay = (date = new Date()) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const startOfUtcWeek = (date = new Date()) => {
  const start = startOfUtcDay(date);
  const weekday = start.getUTCDay() || 7;
  start.setUTCDate(start.getUTCDate() - weekday + 1);
  return start;
};

const periodFor = (type) => {
  const start = type === "weekly" ? startOfUtcWeek() : startOfUtcDay();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + (type === "weekly" ? 7 : 1));
  return {
    start,
    end,
    key: `${type === "weekly" ? "week" : "day"}:${toDateKey(start, "UTC")}`,
  };
};

const activityMetrics = (activities) => ({
  questions: activities
    .filter((item) => item.type === "question_answered")
    .reduce((sum, item) => sum + (item.metadata?.count || 1), 0),
  completed: activities.filter((item) => item.type === "interview_completed").length,
  evaluations: activities.filter((item) => item.type === "evaluation_generated").length,
});

export const synchronizeUserGamification = async (userId) => {
  const [interviews, resumeCount, activities] = await Promise.all([
    Interview.find({ user: userId }).select("status score voiceMetadata duration").lean(),
    Resume.countDocuments({ user: userId }),
    UserActivity.find({ user: userId })
      .select("type metadata xpAwarded occurredAt")
      .lean(),
  ]);
  const completed = interviews.filter((item) => item.status === "completed");
  const metrics = {
    completed: completed.length,
    highestScore: Math.max(0, ...interviews.map((item) => item.score || 0)),
    resumes: resumeCount,
    voiceCompleted: completed.filter((item) => item.voiceMetadata?.mode === "voice").length,
    questionsAnswered: activityMetrics(activities).questions,
    totalPracticeMinutes: Math.round(
      completed.reduce((sum, item) => sum + (item.duration || 0), 0) / 60,
    ),
  };
  const { progress, activeToday } = await synchronizeProgress(userId, metrics, "UTC");
  const badges = await synchronizeBadges(userId, {
    ...metrics,
    longestStreak: progress.longestStreak,
  });
  return { progress, badges, activeToday };
};

export const getChallenges = async (userId) => {
  const periods = Object.fromEntries(
    ["daily", "weekly"].map((type) => [type, periodFor(type)]),
  );
  const [activities, claims] = await Promise.all([
    UserActivity.find({
      user: userId,
      occurredAt: { $gte: periods.weekly.start },
    })
      .select("type metadata occurredAt")
      .lean(),
    ChallengeClaim.find({
      user: userId,
      periodKey: { $in: [periods.daily.key, periods.weekly.key] },
    }).lean(),
  ]);
  const claimed = new Set(
    claims.map((item) => `${item.challengeKey}:${item.periodKey}`),
  );

  return CHALLENGES.map((definition) => {
    const period = periods[definition.type];
    const periodActivities = activities.filter(
      (item) => item.occurredAt >= period.start && item.occurredAt < period.end,
    );
    const progress = activityMetrics(periodActivities)[definition.metric];
    return {
      ...definition,
      progress: Math.min(progress, definition.target),
      completed: progress >= definition.target,
      claimed: claimed.has(`${definition.key}:${period.key}`),
      resetsAt: period.end,
    };
  });
};

export const claimChallenge = async (userId, challengeKey) => {
  const definition = CHALLENGES.find((item) => item.key === challengeKey);
  if (!definition) throw createHttpError(404, "Challenge not found");

  const challenge = (await getChallenges(userId)).find(
    (item) => item.key === challengeKey,
  );
  if (!challenge.completed) {
    throw createHttpError(400, "Complete the challenge before claiming its reward");
  }
  if (challenge.claimed) {
    throw createHttpError(409, "Challenge reward has already been claimed");
  }

  const period = periodFor(definition.type);
  let claim;
  try {
    claim = await ChallengeClaim.create({
      user: userId,
      challengeKey,
      periodKey: period.key,
      xpAwarded: definition.xp,
    });
    await UserActivity.create({
      user: userId,
      eventKey: `challenge:${challengeKey}:${period.key}`,
      type: "challenge_reward",
      title: "Challenge reward claimed",
      description: definition.title,
      relatedEntityType: "challenge",
      metadata: { challengeKey, periodKey: period.key },
      xpAwarded: definition.xp,
    });
  } catch (error) {
    if (claim) await ChallengeClaim.deleteOne({ _id: claim._id }).catch(() => {});
    if (error.code === 11000) {
      throw createHttpError(409, "Challenge reward has already been claimed");
    }
    throw error;
  }

  const { progress } = await synchronizeUserGamification(userId);
  return {
    challenge: { ...challenge, claimed: true },
    xp: progress.xp,
    level: progress.level,
  };
};

export const getGamificationProfile = async (userId) => {
  const [{ progress, badges, activeToday }, challenges, recentRewards] =
    await Promise.all([
      synchronizeUserGamification(userId),
      getChallenges(userId),
      ChallengeClaim.find({ user: userId })
        .sort({ claimedAt: -1 })
        .limit(8)
        .lean(),
    ]);
  const currentLevelBase = (progress.level - 1) * 250;
  return {
    xp: progress.xp,
    level: progress.level,
    xpPerLevel: 250,
    currentLevelXp: progress.xp - currentLevelBase,
    nextLevelXp: progress.level * 250,
    levelProgress: Math.min(
      Math.round(((progress.xp - currentLevelBase) / 250) * 100),
      100,
    ),
    currentStreak: progress.currentStreak,
    longestStreak: progress.longestStreak,
    activeToday,
    earnedBadges: badges.filter((item) => item.earned).length,
    totalBadges: badges.length,
    availableRewards: challenges.filter((item) => item.completed && !item.claimed).length,
    recentRewards,
  };
};

export const getBadges = async (userId) =>
  (await synchronizeUserGamification(userId)).badges;

export const getRewardHistory = async (userId, limit = 50) => {
  const activities = await UserActivity.find({
    user: userId,
    xpAwarded: { $gt: 0 },
  })
    .sort({ occurredAt: -1 })
    .limit(Math.min(Number(limit) || 50, 100))
    .lean();
  return activities.map((item) => ({
    ...formatActivity(item),
    xpAwarded: item.xpAwarded,
  }));
};

export const getLeaderboard = async (userId) => {
  const rows = await UserActivity.aggregate([
    { $group: { _id: "$user", xp: { $sum: "$xpAwarded" } } },
    { $sort: { xp: -1, _id: 1 } },
    { $limit: 50 },
  ]);
  const users = await User.find({ _id: { $in: rows.map((row) => row._id) } })
    .select("name")
    .lean();
  const names = new Map(users.map((user) => [user._id.toString(), user.name]));
  return rows.map((row, index) => ({
    rank: index + 1,
    userId: row._id,
    name: names.get(row._id.toString()) || "User",
    xp: row.xp,
    level: levelForXp(row.xp),
    isCurrentUser: row._id.equals(userId),
  }));
};
