import Interview from "../../models/Interview.js";
import Resume from "../../models/Resume.js";
import ScheduledInterview from "../../models/ScheduledInterview.js";
import UserActivity from "../../models/UserActivity.js";
import UserGoal from "../../models/UserGoal.js";
import { formatActivity, recordActivity, syncHistoricalActivities } from "./activityService.js";
import { addUtcDays, isValidTimezone, toDateKey } from "./dateUtils.js";
import { levelForXp, synchronizeBadges, synchronizeProgress } from "./gamificationService.js";
import { calculateTopicInsights } from "./topicInsightsService.js";

const round = (value) => Math.round((value || 0) * 10) / 10;

const formatInterview = (interview) => ({
  id: interview._id,
  role: interview.role,
  difficulty: interview.difficulty,
  interviewType: interview.interviewType,
  status: interview.status,
  score: interview.score,
  durationMinutes: interview.duration ? Math.round(interview.duration / 60) : 0,
  answeredQuestions: interview.answers?.filter((answer) => answer?.trim()).length || 0,
  totalQuestions: interview.totalQuestions || interview.questions?.length || 0,
  createdAt: interview.createdAt,
  updatedAt: interview.updatedAt,
  completedAt: interview.completedAt,
});

const buildTimeSeries = (activities, timezone, days) => {
  const today = toDateKey(new Date(), timezone);
  const byDay = new Map();
  activities.forEach((activity) => {
    const key = toDateKey(activity.occurredAt, timezone);
    const day = byDay.get(key) || { interviewsCompleted: 0, questionsAnswered: 0, scores: [], practiceMinutes: 0, activityCount: 0 };
    day.activityCount += 1;
    if (activity.type === "interview_completed") {
      day.interviewsCompleted += 1;
      day.practiceMinutes += activity.metadata?.durationMinutes || 0;
    }
    if (activity.type === "question_answered") day.questionsAnswered += activity.metadata?.count || 1;
    if (activity.type === "evaluation_generated" && Number.isFinite(activity.metadata?.score)) day.scores.push(activity.metadata.score);
    byDay.set(key, day);
  });
  return Array.from({ length: days }, (_, index) => {
    const date = addUtcDays(today, index - days + 1);
    const day = byDay.get(date) || { interviewsCompleted: 0, questionsAnswered: 0, scores: [], practiceMinutes: 0, activityCount: 0 };
    return {
      date,
      interviewsCompleted: day.interviewsCompleted,
      questionsAnswered: day.questionsAnswered,
      averageScore: day.scores.length ? round(day.scores.reduce((sum, score) => sum + score, 0) / day.scores.length) : null,
      practiceMinutes: day.practiceMinutes,
      activityCount: day.activityCount,
    };
  });
};

const buildCoach = ({ metrics, weakTopics, recentScores }) => {
  const weakTopic = weakTopics[0] || null;
  const improvement = recentScores.length >= 2
    ? round(recentScores[0] - recentScores[1])
    : null;
  if (!metrics.totalInterviews) return {
    primaryRecommendation: "Start your first tailored interview to unlock coaching insights.",
    weakTopic: null, recentImprovement: null,
    recommendedAction: { label: "Start first interview", path: "/interview/setup" },
  };
  return {
    primaryRecommendation: weakTopic
      ? `Focus your next practice on ${weakTopic.topic}; it is currently your clearest improvement opportunity.`
      : "Keep building evidence with another interview so topic-level recommendations become more precise.",
    weakTopic,
    recentImprovement: improvement,
    recommendedAction: { label: weakTopic ? `Practice ${weakTopic.topic}` : "Start another interview", path: "/interview/setup" },
  };
};

export const getOrCreateGoal = (userId, timezone) =>
  UserGoal.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, target: 5, goalType: "questions" }, $set: { timezone } },
    { upsert: true, returnDocument: "after" },
  ).lean();

export const updateGoal = async (userId, { target, timezone }) => {
  if (!isValidTimezone(timezone)) {
    const error = new Error("Invalid timezone");
    error.statusCode = 400;
    throw error;
  }
  return UserGoal.findOneAndUpdate(
    { user: userId },
    { $set: { goalType: "questions", target, timezone } },
    { upsert: true, returnDocument: "after", runValidators: true },
  ).lean();
};

export const buildDashboardOverview = async (user, requestedTimezone = "UTC") => {
  const timezone = isValidTimezone(requestedTimezone) ? requestedTimezone : "UTC";
  const [interviews, resumes, goal, upcoming] = await Promise.all([
    Interview.find({ user: user._id })
      .select("role experienceLevel difficulty interviewType status score duration totalQuestions questions answers generatedQuestions evaluations voiceMetadata startedAt completedAt createdAt updatedAt")
      .sort({ createdAt: -1 })
      .lean(),
    Resume.find({ user: user._id }).select("originalFileName isActive uploadDate createdAt").sort({ createdAt: 1 }).lean(),
    getOrCreateGoal(user._id, timezone),
    ScheduledInterview.find({ user: user._id, status: "scheduled", scheduledAt: { $gte: new Date() } })
      .sort({ scheduledAt: 1 }).limit(3).lean(),
  ]);

  await syncHistoricalActivities(user._id, interviews, resumes);
  let activities = await UserActivity.find({ user: user._id }).sort({ occurredAt: -1 }).limit(500).lean();
  const completed = interviews.filter((item) => item.status === "completed");
  const evaluated = interviews.filter((item) => item.evaluations?.length && item.score != null);
  const questionsAnswered = interviews.reduce((sum, item) => sum + (item.answers?.filter((answer) => answer?.trim()).length || 0), 0);
  const totalPracticeMinutes = Math.round(completed.reduce((sum, item) => sum + (item.duration || 0), 0) / 60);
  const scores = evaluated.map((item) => item.score);
  const metrics = {
    totalInterviews: interviews.length,
    completed: completed.length,
    completedInterviews: completed.length,
    averageScore: scores.length ? round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
    highestScore: scores.length ? Math.max(...scores) : 0,
    questionsAnswered,
    totalPracticeMinutes,
    resumes: resumes.length,
    voiceCompleted: completed.filter((item) => item.voiceMetadata?.mode === "voice").length,
  };
  let { progress, activeToday } = await synchronizeProgress(user._id, metrics, timezone);
  const todayKey = toDateKey(new Date(), timezone);
  const todayQuestionCount = activities
    .filter((item) => item.type === "question_answered" && toDateKey(item.occurredAt, timezone) === todayKey)
    .reduce((sum, item) => sum + (item.metadata?.count || 1), 0);
  const goalCompleted = todayQuestionCount >= goal.target;
  if (goalCompleted) {
    await recordActivity({
      user: user._id, eventKey: `goal:${todayKey}:questions`, type: "daily_goal_completed",
      title: "Daily goal completed", description: `${goal.target} interview questions answered`,
      metadata: { count: todayQuestionCount }, xpAwarded: 30, occurredAt: new Date(),
    });
    ({ progress, activeToday } = await synchronizeProgress(user._id, metrics, timezone));
  }
  metrics.longestStreak = progress.longestStreak;
  const badges = await synchronizeBadges(user._id, metrics);
  activities = await UserActivity.find({ user: user._id }).sort({ occurredAt: -1 }).limit(500).lean();
  const { weakTopics, strongTopics } = calculateTopicInsights(evaluated);
  const weeklyProgress = buildTimeSeries(activities, timezone, 7);
  const heatmap = buildTimeSeries(activities, timezone, 84).map(({ date, questionsAnswered: count, activityCount }) => ({ date, count, activityCount }));
  const continueInterview = interviews.find((item) => item.status === "draft") || null;
  const recentScores = evaluated
    .sort((a, b) => new Date(b.evaluations.at(-1).evaluatedAt) - new Date(a.evaluations.at(-1).evaluatedAt))
    .map((item) => item.score);
  const thisWeek = weeklyProgress.reduce((result, day) => ({
    completed: result.completed + day.interviewsCompleted,
    questions: result.questions + day.questionsAnswered,
    minutes: result.minutes + day.practiceMinutes,
  }), { completed: 0, questions: 0, minutes: 0 });
  const nextLevelXp = progress.level * 250;
  const currentLevelBase = (progress.level - 1) * 250;
  const calendarActivity = heatmap.slice(-35).filter((day) => day.activityCount > 0);

  return {
    user: {
      firstName: user.name.trim().split(/\s+/)[0],
      targetRole: continueInterview?.role || interviews[0]?.role || null,
    },
    summary: {
      ...metrics,
      currentStreak: progress.currentStreak,
      longestStreak: progress.longestStreak,
      activeToday,
      evaluatedInterviews: evaluated.length,
      thisWeek,
      resumeScore: null,
    },
    dailyGoal: {
      type: goal.goalType,
      target: goal.target,
      progress: todayQuestionCount,
      percentage: Math.min(Math.round((todayQuestionCount / goal.target) * 100), 100),
      completed: goalCompleted,
      timezone,
      resetsAt: addUtcDays(todayKey, 1),
    },
    continueInterview: continueInterview ? formatInterview(continueInterview) : null,
    weeklyProgress,
    heatmap,
    recentInterviews: interviews.slice(0, 6).map(formatInterview),
    activity: activities.slice(0, 8).map(formatActivity),
    weakTopics,
    strongTopics,
    aiCoach: buildCoach({ metrics, weakTopics, recentScores }),
    gamification: {
      xp: progress.xp,
      level: progress.level,
      currentLevelXp: progress.xp - currentLevelBase,
      xpForNextLevel: 250,
      nextLevelXp,
      percentage: Math.min(Math.round(((progress.xp - currentLevelBase) / 250) * 100), 100),
      rules: { question: 5, interview: 50, dailyGoal: 30, highScore: 25, firstResume: 50, firstVoice: 40 },
    },
    badges: badges.slice(0, 8),
    upcomingInterviews: upcoming.map((item) => ({
      id: item._id, title: item.title, role: item.role, interviewType: item.interviewType,
      difficulty: item.difficulty, scheduledAt: item.scheduledAt, notes: item.notes,
      reminderEnabled: item.reminderEnabled, status: item.status,
    })),
    calendarActivity,
    activeResume: resumes.find((item) => item.isActive)
      ? { id: resumes.find((item) => item.isActive)._id, originalFileName: resumes.find((item) => item.isActive).originalFileName }
      : null,
  };
};

export const getActivityPage = async (userId, limit = 30) =>
  UserActivity.find({ user: userId }).sort({ occurredAt: -1 }).limit(limit).lean().then((items) => items.map(formatActivity));

export const getBadgeOverview = async (userId) => {
  const progress = await import("../../models/UserProgress.js").then(({ default: model }) => model.findOne({ user: userId }).lean());
  return { xp: progress?.xp || 0, level: progress?.level || levelForXp(0) };
};
