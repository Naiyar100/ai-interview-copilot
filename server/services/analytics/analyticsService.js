import Interview from "../../models/Interview.js";
import Resume from "../../models/Resume.js";
import UserActivity from "../../models/UserActivity.js";
import UserBadge from "../../models/UserBadge.js";
import UserGoal from "../../models/UserGoal.js";
import UserProgress from "../../models/UserProgress.js";
import companyProfiles from "../../config/companyPreparationProfiles.js";
import { BADGES } from "../dashboard/gamificationService.js";
import { addUtcDays, calculateStreak, toDateKey } from "../dashboard/dateUtils.js";
import { analyticsCacheKey, getCachedAnalytics, setCachedAnalytics } from "./cacheService.js";
import { buildInterviewFilter, dateKeyToUtc, previousPeriodFilters } from "./filterBuilder.js";

const round = (value, digits = 1) => Number((Number(value) || 0).toFixed(digits));
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const percent = (part, total) => total ? round(part / total * 100) : 0;
const words = (value = "") => value.trim() ? value.trim().split(/\s+/).length : 0;
const unique = (items) => [...new Set(items.filter(Boolean))];
const labelConfidence = (count) => count >= 8 ? "High" : count >= 3 ? "Medium" : "Low";
const change = (current, previous) => ({
  current: current ?? null,
  previous: previous ?? null,
  absolute: current == null || previous == null ? null : round(current - previous),
  percentage: current == null || !previous ? null : round((current - previous) / Math.abs(previous) * 100),
  direction: current == null || previous == null || current === previous ? "neutral" : current > previous ? "up" : "down",
});
const latestEvaluation = (interview) => interview.evaluations?.at(-1) || null;

const interviewSummary = (interviews) => {
  const completed = interviews.filter((item) => item.status === "completed");
  const evaluated = interviews.filter((item) => item.score != null && latestEvaluation(item));
  const scores = evaluated.map((item) => item.score);
  const answered = interviews.reduce((sum, item) => sum + (item.answers || []).filter((answer) => answer?.trim()).length, 0);
  const questionScores = evaluated.flatMap((item) => latestEvaluation(item).questions.map((question) => question.score * 10));
  const totalSeconds = completed.reduce((sum, item) => sum + (item.duration || 0), 0);
  return {
    totalInterviews: interviews.length,
    completedInterviews: completed.length,
    completionRate: percent(completed.length, interviews.length),
    averageScore: scores.length ? round(average(scores)) : null, highestScore: scores.length ? Math.max(...scores) : null,
    lowestScore: scores.length ? Math.min(...scores) : null, medianScore: scores.length ? round(median(scores)) : null,
    questionsAnswered: answered, averageQuestionScore: questionScores.length ? round(average(questionScores)) : null,
    totalPracticeMinutes: round(totalSeconds / 60),
    averageInterviewMinutes: completed.length ? round(totalSeconds / completed.length / 60) : null,
    evaluatedInterviews: evaluated.length,
  };
};

const withPrevious = (current, previous) => ({
  ...current,
  comparisons: Object.fromEntries([
    "totalInterviews", "completedInterviews", "completionRate", "averageScore", "highestScore",
    "questionsAnswered", "averageQuestionScore", "totalPracticeMinutes", "averageInterviewMinutes",
  ].map((key) => [key, previous ? change(current[key], previous[key]) : { ...change(null, null), current: current[key] ?? null }])),
});

const groupKey = (date, aggregation, timezone) => {
  const key = toDateKey(date, timezone);
  if (aggregation === "month") return key.slice(0, 7);
  if (aggregation === "week") {
    const day = new Date(`${key}T12:00:00Z`).getUTCDay();
    return addUtcDays(key, -(day === 0 ? 6 : day - 1));
  }
  return key;
};

const performanceTrend = (interviews, filters) => {
  const groups = new Map();
  interviews.filter((item) => item.score != null).forEach((item) => {
    const date = latestEvaluation(item)?.evaluatedAt || item.completedAt || item.updatedAt;
    const key = groupKey(date, filters.aggregation, filters.timezone);
    const current = groups.get(key) || [];
    current.push(item.score);
    groups.set(key, current);
  });
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([period, scores]) => ({
    period, overallScore: round(average(scores)), sampleSize: scores.length,
    technicalScore: round(average(scores)), communicationScore: null, problemSolvingScore: null,
    completenessScore: null, clarityScore: null,
  }));
};

const activityTrend = (activities, filters) => {
  const groups = new Map();
  activities.forEach((activity) => {
    const key = groupKey(activity.occurredAt, filters.aggregation, filters.timezone);
    const item = groups.get(key) || { period: key, interviewsStarted: 0, interviewsCompleted: 0, questionsAnswered: 0, practiceMinutes: 0, evaluationsGenerated: 0 };
    if (activity.type === "interview_created") item.interviewsStarted += 1;
    if (activity.type === "interview_completed") { item.interviewsCompleted += 1; item.practiceMinutes += activity.metadata?.durationMinutes || 0; }
    if (activity.type === "question_answered") item.questionsAnswered += activity.metadata?.count || 1;
    if (activity.type === "evaluation_generated") item.evaluationsGenerated += 1;
    groups.set(key, item);
  });
  return [...groups.values()].sort((a, b) => a.period.localeCompare(b.period));
};

const questionRecords = (interviews) => interviews.flatMap((interview) => {
  const evaluation = latestEvaluation(interview);
  return (interview.questions || []).map((question, index) => {
    const detail = interview.generatedQuestions?.[index];
    const feedback = evaluation?.questions?.find((item) => item.questionId === (detail?.id || index + 1));
    return {
      interviewId: interview._id.toString(), role: interview.role, date: evaluation?.evaluatedAt || interview.completedAt || interview.updatedAt,
      question, answer: interview.answers?.[index] || "", transcript: interview.transcripts?.[index] || "",
      category: detail?.category || "Uncategorized", topics: unique([...(detail?.expectedTopics || []), ...(feedback?.topicsToStudy || [])]),
      score: feedback ? feedback.score * 10 : null, feedback: feedback?.feedback || "",
    };
  });
});

const masteryLabel = (score, attempts) => {
  if (attempts < 2) return "Beginner";
  if (score < 40) return "Beginner";
  if (score < 60) return "Developing";
  if (score < 75) return "Competent";
  if (score < 90 || attempts < 5) return "Strong";
  return "Mastered";
};

const topicAnalytics = (records, filters) => {
  const map = new Map();
  records.filter((item) => item.score != null).forEach((record) => {
    unique([record.category, ...record.topics]).forEach((topic) => {
      const key = topic.toLowerCase();
      const item = map.get(key) || { topic, scores: [], dates: [] };
      item.scores.push(record.score); item.dates.push(record.date); map.set(key, item);
    });
  });
  const mastery = [...map.values()].map((item) => {
    const score = round(average(item.scores));
    const midpoint = Math.max(Math.floor(item.scores.length / 2), 1);
    const earlier = average(item.scores.slice(0, midpoint));
    const recent = average(item.scores.slice(midpoint));
    const trend = recent == null || earlier == null ? null : round(recent - earlier);
    return {
      topic: item.topic, averageScore: score, attempts: item.scores.length, trend,
      lastPracticedAt: [...item.dates].sort((a, b) => new Date(b) - new Date(a))[0],
      mastery: masteryLabel(score, item.scores.length), confidence: labelConfidence(item.scores.length),
      nextAction: score < 60 ? `Practice 3 focused ${item.topic} questions` : score < 80 ? `Try a harder ${item.topic} interview` : `Maintain ${item.topic} with spaced practice`,
    };
  }).sort((a, b) => b.attempts - a.attempts || b.averageScore - a.averageScore);
  const heat = new Map();
  records.filter((item) => item.score != null).forEach((record) => unique([record.category, ...record.topics]).forEach((topic) => {
    const period = groupKey(record.date, filters.aggregation === "day" ? "week" : filters.aggregation, filters.timezone);
    const key = `${topic}|${period}`;
    const cell = heat.get(key) || { topic, period, scores: [] }; cell.scores.push(record.score); heat.set(key, cell);
  }));
  return {
    mastery,
    heatmap: [...heat.values()].map((item) => ({ topic: item.topic, period: item.period, attempts: item.scores.length, averageScore: round(average(item.scores)) })).slice(0, 120),
  };
};

const breakdown = (interviews, key) => [...new Set(interviews.map((item) => item[key]).filter(Boolean))].map((value) => {
  const subset = interviews.filter((item) => item[key] === value);
  const summary = interviewSummary(subset);
  const scored = subset.filter((item) => item.score != null).sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
  return {
    value, interviews: subset.length, completed: summary.completedInterviews, questions: subset.reduce((sum, item) => sum + (item.questions?.length || 0), 0),
    averageScore: summary.averageScore, completionRate: summary.completionRate,
    averageDurationMinutes: summary.averageInterviewMinutes,
    trend: scored.length > 1 ? round(scored.at(-1).score - scored[0].score) : null,
    lastPracticedAt: [...subset].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0]?.updatedAt || null,
  };
}).sort((a, b) => b.interviews - a.interviews);

const answerAnalytics = (records) => {
  const lengths = records.map((item) => words(item.answer));
  const scored = records.filter((item) => item.score != null);
  const answered = records.filter((item) => item.answer.trim());
  const concepts = new Map();
  scored.filter((item) => item.score < 70).forEach((item) => item.topics.forEach((topic) => concepts.set(topic, (concepts.get(topic) || 0) + 1)));
  const scoreBuckets = [
    { label: "0-39", min: 0, max: 39 }, { label: "40-59", min: 40, max: 59 },
    { label: "60-69", min: 60, max: 69 }, { label: "70-79", min: 70, max: 79 },
    { label: "80-89", min: 80, max: 89 }, { label: "90-100", min: 90, max: 100 },
  ].map((bucket) => ({ ...bucket, count: scored.filter((item) => item.score >= bucket.min && item.score <= bucket.max).length }));
  return {
    averageAnswerWords: round(average(lengths)), averageQuestionScore: round(average(scored.map((item) => item.score))),
    unansweredPercentage: percent(records.length - answered.length, records.length),
    partiallyAnsweredPercentage: percent(answered.filter((item) => words(item.answer) < 20).length, records.length),
    topicCoverage: unique(records.flatMap((item) => item.topics)).length,
    frequentlyMissedConcepts: [...concepts].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([topic, misses]) => ({ topic, misses })),
    scoreDistribution: scoreBuckets.map((item) => ({ ...item, percentage: percent(item.count, scored.length) })),
    answerLengthDistribution: [
      { label: "0 words", count: lengths.filter((value) => value === 0).length },
      { label: "1-19", count: lengths.filter((value) => value > 0 && value < 20).length },
      { label: "20-49", count: lengths.filter((value) => value >= 20 && value < 50).length },
      { label: "50+", count: lengths.filter((value) => value >= 50).length },
    ],
    note: "Answer length is descriptive only; longer answers are not automatically better.",
  };
};

const practiceAnalytics = (interviews, filters) => {
  const completed = interviews.filter((item) => item.status === "completed" && item.duration != null);
  const seconds = completed.map((item) => item.duration);
  const localHours = completed.map((item) => Number(new Intl.DateTimeFormat("en-US", { timeZone: filters.timezone, hour: "2-digit", hour12: false }).format(new Date(item.completedAt))));
  const periods = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
  localHours.forEach((hour) => { periods[hour < 6 ? "Night" : hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening"] += 1; });
  const weekdays = new Map();
  completed.forEach((item) => { const day = new Intl.DateTimeFormat("en-US", { timeZone: filters.timezone, weekday: "long" }).format(new Date(item.completedAt)); weekdays.set(day, (weekdays.get(day) || 0) + 1); });
  const timeBy = (key) => breakdown(completed, key).map((item) => ({ label: item.value, minutes: round(completed.filter((current) => current[key] === item.value).reduce((sum, current) => sum + current.duration, 0) / 60) }));
  return {
    totalMinutes: round(seconds.reduce((sum, value) => sum + value, 0) / 60), averageSessionMinutes: seconds.length ? round(average(seconds) / 60) : null,
    longestSessionMinutes: seconds.length ? round(Math.max(...seconds) / 60) : null,
    mostActiveDay: [...weekdays].sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    mostActiveTime: Object.entries(periods).sort((a, b) => b[1] - a[1])[0]?.[1] ? Object.entries(periods).sort((a, b) => b[1] - a[1])[0][0] : null,
    byInterviewType: timeBy("interviewType"), byRole: timeBy("role"), byDifficulty: timeBy("difficulty"),
  };
};

const voiceAnalytics = (interviews, records) => {
  const voice = interviews.filter((item) => item.voiceMetadata?.mode === "voice");
  const completedVoice = voice.filter((item) => item.status === "completed");
  const typedScores = interviews.filter((item) => item.voiceMetadata?.mode !== "voice" && item.score != null).map((item) => item.score);
  const voiceScores = voice.filter((item) => item.score != null).map((item) => item.score);
  const transcripts = records.filter((item) => voice.some((interview) => interview._id.toString() === item.interviewId)).map((item) => words(item.transcript));
  return {
    interviews: voice.length, completed: completedVoice.length, usageRate: percent(voice.length, interviews.length), completionRate: percent(completedVoice.length, voice.length),
    averageTranscriptWords: round(average(transcripts)), recordingAttempts: voice.reduce((sum, item) => sum + (item.voiceMetadata?.recordingAttempts || 0), 0),
    averageVoiceScore: round(average(voiceScores)), averageTypedScore: round(average(typedScores)),
    scoreDifference: voiceScores.length && typedScores.length ? round(average(voiceScores) - average(typedScores)) : null,
    note: "Voice analytics use saved transcripts and metadata only. Raw audio and emotion are not analyzed.",
  };
};

const resumeScore = (resume) => {
  const summary = resume?.summary || {};
  const sections = ["skills", "education", "experience", "projects", "certifications", "technologies"];
  const complete = sections.filter((key) => summary[key]?.length).length;
  const keywords = unique([...(summary.keywords || []), ...(summary.skills || []), ...(summary.technologies || [])]).length;
  return resume ? Math.round((complete / sections.length) * 70 + Math.min(keywords / 20, 1) * 30) : null;
};

const resumeAnalytics = (resumes) => {
  const ordered = [...resumes].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const current = ordered.find((item) => item.isActive) || ordered.at(-1);
  const previous = [...ordered].filter((item) => item._id.toString() !== current?._id.toString()).at(-1);
  const currentScore = resumeScore(current); const previousScore = resumeScore(previous);
  return {
    versions: resumes.length, currentResumeId: current?._id || null, currentScore, previousScore,
    scoreChange: currentScore != null && previousScore != null ? currentScore - previousScore : null,
    sectionCompleteness: current ? Object.fromEntries(["skills", "education", "experience", "projects", "certifications", "technologies"].map((key) => [key, Boolean(current.summary?.[key]?.length)])) : {},
    keywordCount: current ? unique([...(current.summary?.keywords || []), ...(current.summary?.skills || []), ...(current.summary?.technologies || [])]).length : 0,
    lastAnalyzedAt: current?.updatedAt || null,
    history: ordered.map((item) => ({ id: item._id, name: item.originalFileName, score: resumeScore(item), analyzedAt: item.updatedAt })),
    scoreLabel: "Resume readiness score",
    note: "This deterministic completeness and keyword-coverage score is not an ATS hiring score.",
  };
};

const consistencyAnalytics = (activities, goal, filters) => {
  const activeTypes = new Set(["question_answered", "interview_completed", "evaluation_generated", "daily_goal_completed"]);
  const dateKeys = unique(activities.filter((item) => activeTypes.has(item.type)).map((item) => toDateKey(item.occurredAt, filters.timezone)));
  const today = toDateKey(new Date(), filters.timezone);
  const start = filters.startDate || dateKeys.sort()[0] || today;
  const end = filters.endDate || today;
  const days = Math.max(Math.round((new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000) + 1, 1);
  const streak = calculateStreak(dateKeys, today);
  const goalsCompleted = activities.filter((item) => item.type === "daily_goal_completed").length;
  const activeDayRate = Math.min(dateKeys.length / days, 1) * 100;
  const goalCompletionRate = Math.min(goalsCompleted / days, 1) * 100;
  const gaps = dateKeys.sort().slice(1).map((key, index) => (new Date(`${key}T00:00:00Z`) - new Date(`${dateKeys[index]}T00:00:00Z`)) / 86400000);
  const spacing = gaps.length ? Math.max(0, 100 - average(gaps.map((gap) => Math.abs(gap - 1))) * 25) : activeDayRate;
  const streakFactor = Math.min(streak.current / 7, 1) * 100;
  return {
    currentStreak: streak.current, longestStreak: streak.longest, activeDays: dateKeys.length, missedDays: Math.max(days - dateKeys.length, 0),
    practiceFrequencyPerWeek: round(dateKeys.length / days * 7), goalCompletionRate: round(goalCompletionRate),
    weeklyConsistencyScore: round(activeDayRate * .4 + goalCompletionRate * .3 + spacing * .2 + streakFactor * .1),
    monthlyConsistencyScore: round(activeDayRate * .4 + goalCompletionRate * .3 + spacing * .2 + streakFactor * .1),
    currentGoal: goal ? { type: goal.goalType, target: goal.target } : null,
    formula: { activeDayRate: 40, goalCompletion: 30, sessionSpacing: 20, currentStreak: 10 },
  };
};

const roleAnalytics = (interviews, topics, consistency, resumes) => breakdown(interviews, "role").map((item) => {
  const subset = interviews.filter((interview) => interview.role === item.value);
  const scored = subset.filter((interview) => interview.score != null);
  const score = average(scored.map((interview) => interview.score));
  const categories = unique(questionRecords(subset).flatMap((record) => [record.category, ...record.topics]));
  const difficulty = Math.max(0, ...subset.map((interview) => ({ Easy: 40, Medium: 70, Hard: 100 }[interview.difficulty] || 0)));
  const resumeRelevance = resumes.at(-1) ? Math.min(unique([...(resumes.at(-1).summary?.skills || []), ...(resumes.at(-1).summary?.technologies || [])]).length / 12 * 100, 100) : null;
  const recencyDays = item.lastPracticedAt ? (Date.now() - new Date(item.lastPracticedAt)) / 86400000 : Infinity;
  const factors = {
    interviewScore: score, topicCoverage: Math.min(categories.length / 8 * 100, 100), difficultyExposure: difficulty,
    communication: null, consistency: consistency.weeklyConsistencyScore, resumeRelevance,
    recency: Math.max(0, 100 - recencyDays * 3),
  };
  const weights = { interviewScore: 30, topicCoverage: 20, difficultyExposure: 15, communication: 10, consistency: 10, resumeRelevance: 10, recency: 5 };
  const available = Object.entries(weights).filter(([key]) => factors[key] != null && Number.isFinite(factors[key]));
  const totalWeight = available.reduce((sum, [, weight]) => sum + weight, 0);
  const readiness = totalWeight ? round(available.reduce((sum, [key, weight]) => sum + factors[key] * weight, 0) / totalWeight) : 0;
  const level = readiness >= 85 ? "Strong Candidate" : readiness >= 70 ? "Interview Ready" : readiness >= 55 ? "Nearly Ready" : readiness >= 35 ? "Building Foundation" : "Getting Started";
  const roleTopics = topics.mastery.filter((topic) => questionRecords(subset).some((record) => [record.category, ...record.topics].some((name) => name.toLowerCase() === topic.topic.toLowerCase())));
  return {
    role: item.value, ...item, practiceMinutes: round(subset.reduce((sum, interview) => sum + (interview.duration || 0), 0) / 60),
    strongTopics: roleTopics.filter((topic) => topic.averageScore >= 75).slice(0, 3).map((topic) => topic.topic),
    weakTopics: roleTopics.filter((topic) => topic.averageScore < 75).slice(0, 3).map((topic) => topic.topic),
    readinessScore: readiness, readinessLevel: level, factors, missingRequirements: Object.entries(factors).filter(([, value]) => value == null).map(([key]) => key),
    nextSteps: [score == null ? "Complete and evaluate an interview" : score < 70 ? "Improve answer correctness" : null, difficulty < 100 ? "Add hard-difficulty exposure" : null, categories.length < 6 ? "Broaden topic coverage" : null].filter(Boolean),
    confidence: labelConfidence(scored.length), completedCount: scored.length,
  };
});

const companyAnalytics = ({ summary, records, interviews, resumes, consistency }) => {
  const scoreFor = (pattern) => average(records.filter((item) => pattern.test(`${item.category} ${item.topics.join(" ")}`)).map((item) => item.score).filter((score) => score != null));
  const competencies = {
    technical: summary.averageQuestionScore, problemSolving: scoreFor(/dsa|algorithm|coding|problem/i), systemDesign: scoreFor(/system design|architecture|scalab/i),
    communication: null, behavioral: average(interviews.filter((item) => item.interviewType === "Behavioral" && item.score != null).map((item) => item.score)),
    projects: resumes.length ? resumeScore(resumes.at(-1)) : null,
  };
  return companyProfiles.map((profile) => {
    const available = Object.entries(profile.weights).filter(([key]) => competencies[key] != null);
    const total = available.reduce((sum, [, weight]) => sum + weight, 0);
    const readiness = total ? round(available.reduce((sum, [key, weight]) => sum + competencies[key] * weight, 0) / total * .9 + consistency.weeklyConsistencyScore * .1) : 0;
    const ordered = available.map(([key]) => ({ key, score: round(competencies[key]) })).sort((a, b) => b.score - a.score);
    return {
      company: profile.name, readinessScore: readiness, strongAreas: ordered.filter((item) => item.score >= 75).slice(0, 3),
      missingAreas: Object.keys(profile.weights).filter((key) => competencies[key] == null), weakAreas: ordered.filter((item) => item.score < 65).slice(0, 3),
      suggestedPlan: ordered.length ? `Prioritize ${ordered.at(-1).key.replace(/([A-Z])/g, " $1").toLowerCase()} practice.` : "Complete evaluated interviews to build evidence.",
      evidenceCount: summary.evaluatedInterviews, confidence: labelConfidence(summary.evaluatedInterviews),
      disclaimer: "Preparation readiness is an estimate, not a hiring probability.",
    };
  });
};

const recommendations = ({ summary, topics, consistency, roleReadiness }) => {
  const items = [];
  const weak = [...topics.mastery].sort((a, b) => a.averageScore - b.averageScore)[0];
  if (weak) items.push({ title: `Strengthen ${weak.topic}`, explanation: weak.nextAction, evidence: `${weak.averageScore}% across ${weak.attempts} attempts`, priority: weak.averageScore < 60 ? "High" : "Medium", actionLabel: "Start focused practice", actionRoute: "/interview/setup", trigger: "evaluation" });
  if (summary.completedInterviews < 3) items.push({ title: "Build a stronger practice baseline", explanation: "Complete at least three interviews for more reliable trends.", evidence: `${summary.completedInterviews} completed interviews`, priority: "High", actionLabel: "Start interview", actionRoute: "/interview/setup", trigger: "interview_completion" });
  if (consistency.weeklyConsistencyScore < 60) items.push({ title: "Practice more consistently", explanation: "Short, spaced sessions improve the reliability of your readiness evidence.", evidence: `${consistency.weeklyConsistencyScore}% consistency score`, priority: "Medium", actionLabel: "Schedule practice", actionRoute: "/dashboard", trigger: "activity" });
  const role = roleReadiness[0];
  if (role?.nextSteps?.length) items.push({ title: `Improve ${role.role} readiness`, explanation: role.nextSteps[0], evidence: `${role.readinessScore}% readiness estimate`, priority: "Medium", actionLabel: "Practice this role", actionRoute: "/interview/setup", trigger: "analytics_refresh" });
  if (!items.length) items.push({ title: "Maintain your momentum", explanation: "Continue spaced practice and periodically add harder interviews.", evidence: `${summary.averageScore || 0}% average score`, priority: "Low", actionLabel: "Start next interview", actionRoute: "/interview/setup", trigger: "analytics_refresh" });
  return items.slice(0, 5);
};

const goalAndGamification = (activities, progress, badges, goal, filters) => {
  const xpActivities = activities.filter((item) => item.xpAwarded > 0);
  const xpBySource = [...new Set(xpActivities.map((item) => item.type))].map((type) => ({ type, xp: xpActivities.filter((item) => item.type === type).reduce((sum, item) => sum + item.xpAwarded, 0) }));
  const earned = new Set(badges.map((item) => item.badgeKey));
  const metricMap = { completed: progress?.questionsAnswered ? null : 0, highestScore: null, resumes: null, voiceCompleted: null, longestStreak: progress?.longestStreak || 0 };
  return {
    goals: { current: goal ? { type: goal.goalType, target: goal.target, timezone: goal.timezone } : null, completed: activities.filter((item) => item.type === "daily_goal_completed").length, completionTrend: activityTrend(activities.filter((item) => item.type === "daily_goal_completed"), filters) },
    xp: { earnedInPeriod: xpActivities.reduce((sum, item) => sum + item.xpAwarded, 0), sourceBreakdown: xpBySource, currentXp: progress?.xp || 0, currentLevel: progress?.level || 1, progressToNextLevel: (progress?.xp || 0) % 250, xpPerLevel: 250 },
    badges: { totalEarned: badges.length, recent: badges.slice(0, 5), categoryCompletion: percent(badges.length, BADGES.length), closestToUnlock: BADGES.filter((badge) => !earned.has(badge.key)).slice(0, 3).map((badge) => ({ key: badge.key, name: badge.name, target: badge.target, current: metricMap[badge.metric] ?? null })) },
  };
};

const buildNarrative = (summary, topics, consistency) => {
  if (!summary.totalInterviews) return "No interviews match this range yet. Complete a practice session to unlock performance intelligence.";
  const strong = [...topics.mastery].sort((a, b) => b.averageScore - a.averageScore)[0];
  const weak = [...topics.mastery].sort((a, b) => a.averageScore - b.averageScore)[0];
  const parts = [`You completed ${summary.completedInterviews} of ${summary.totalInterviews} interviews`];
  if (summary.averageScore != null) parts.push(`with a ${summary.averageScore}% average score`);
  if (strong) parts.push(`${strong.topic} is your strongest measured topic`);
  if (weak && weak.topic !== strong?.topic) parts.push(`${weak.topic} is the highest-priority topic`);
  parts.push(`your consistency score is ${consistency.weeklyConsistencyScore}%`);
  return `${parts.join(". ")}.`;
};

export const buildAnalyticsOverview = async (user, filters, { useCache = true } = {}) => {
  const key = analyticsCacheKey(user._id.toString(), filters);
  if (useCache) { const cached = getCachedAnalytics(key); if (cached) return { ...cached, cache: { hit: true, ttlSeconds: 60 } }; }
  const currentFilter = buildInterviewFilter(user._id, filters);
  const previousFilters = previousPeriodFilters(filters);
  const activityFilter = { user: user._id };
  if (filters.startDate || filters.endDate) {
    activityFilter.occurredAt = {};
    if (filters.startDate) activityFilter.occurredAt.$gte = dateKeyToUtc(filters.startDate, filters.timezone);
    if (filters.endDate) activityFilter.occurredAt.$lt = dateKeyToUtc(addUtcDays(filters.endDate, 1), filters.timezone);
  }
  const [interviews, previousInterviews, activities, allActivities, resumes, goal, progress, badges] = await Promise.all([
    Interview.find(currentFilter).select("role experienceLevel difficulty interviewType status score duration totalQuestions questions generatedQuestions answers transcripts voiceMetadata resume evaluations startedAt completedAt createdAt updatedAt").sort({ createdAt: 1 }).lean(),
    previousFilters ? Interview.find(buildInterviewFilter(user._id, previousFilters)).select("status score duration answers questions evaluations").lean() : [],
    UserActivity.find(activityFilter).select("type metadata xpAwarded occurredAt").sort({ occurredAt: 1 }).lean(),
    UserActivity.find({ user: user._id }).select("type occurredAt").sort({ occurredAt: 1 }).lean(),
    Resume.find({ user: user._id }).select("originalFileName summary isActive uploadDate createdAt updatedAt").sort({ createdAt: 1 }).lean(),
    UserGoal.findOne({ user: user._id }).lean(), UserProgress.findOne({ user: user._id }).lean(), UserBadge.find({ user: user._id }).sort({ earnedAt: -1 }).lean(),
  ]);
  const summary = withPrevious(interviewSummary(interviews), previousFilters ? interviewSummary(previousInterviews) : null);
  const records = questionRecords(interviews);
  const topics = topicAnalytics(records, filters);
  const consistency = consistencyAnalytics(allActivities, goal, filters);
  const roles = roleAnalytics(interviews, topics, consistency, resumes);
  const practice = practiceAnalytics(interviews, filters);
  const voice = voiceAnalytics(interviews, records);
  const resume = resumeAnalytics(resumes);
  summary.currentStreak = consistency.currentStreak;
  summary.longestStreak = consistency.longestStreak;
  summary.goalCompletionRate = consistency.goalCompletionRate;
  summary.voiceUsageRate = voice.usageRate;
  summary.resumeScoreChange = resume.scoreChange;
  const gamification = goalAndGamification(activities, progress, badges, goal, filters);
  const result = {
    range: { preset: filters.preset, startDate: filters.startDate, endDate: filters.endDate, timezone: filters.timezone, previous: previousFilters ? { startDate: previousFilters.startDate, endDate: previousFilters.endDate } : null },
    filters: { ...filters, available: { roles: unique(interviews.map((item) => item.role)), categories: unique(records.map((item) => item.category)), resumes: resumes.map((item) => ({ id: item._id, name: item.originalFileName })) } },
    summary, narrative: "", performanceTrend: performanceTrend(interviews, filters), activityTrend: activityTrend(activities, filters),
    skillRadar: [
      ...(summary.evaluatedInterviews ? [{ skill: "Technical correctness", score: summary.averageQuestionScore, sampleSize: records.filter((item) => item.score != null).length }] : []),
      ...(records.length ? [{ skill: "Answer completion", score: round(100 - answerAnalytics(records).unansweredPercentage), sampleSize: records.length }] : []),
      ...(topics.mastery.length ? [{ skill: "Topic coverage", score: round(Math.min(topics.mastery.length / 8 * 100, 100)), sampleSize: topics.mastery.length }] : []),
    ],
    topicMastery: topics.mastery.slice(0, 30), topicHeatmap: topics.heatmap,
    strengths: topics.mastery.filter((item) => item.attempts >= 2).sort((a, b) => b.averageScore - a.averageScore).slice(0, 4),
    weaknesses: topics.mastery.filter((item) => item.averageScore < 75).sort((a, b) => a.averageScore - b.averageScore).slice(0, 4),
    difficultyAnalysis: breakdown(interviews, "difficulty"), interviewTypeAnalysis: breakdown(interviews, "interviewType"),
    communicationTechnical: { technicalScore: summary.averageQuestionScore, communicationScore: null, clarityScore: null, completenessScore: null, problemSolvingScore: null, note: "Separate communication and clarity scores are not stored by the current evaluation schema." },
    answerQuality: answerAnalytics(records), practiceTime: practice, voiceAnalytics: voice, resumeAnalytics: resume, consistency,
    rolePerformance: roles, roleReadiness: roles.map(({ role, readinessScore, readinessLevel, factors, missingRequirements, nextSteps, confidence, completedCount }) => ({ role, readinessScore, readinessLevel, factors, missingRequirements, nextSteps, confidence, evidenceCount: completedCount, disclaimer: "Readiness is an estimate based on your practice data, not a hiring prediction." })),
    companyReadiness: companyAnalytics({ summary, records, interviews, resumes, consistency }),
    goals: gamification.goals, gamification: { xp: gamification.xp, badges: gamification.badges },
    recommendations: [], generatedAt: new Date().toISOString(), cache: { hit: false, ttlSeconds: 60 },
    dataAvailability: { interviews: interviews.length > 0, evaluations: summary.evaluatedInterviews > 0, voice: voice.interviews > 0, resumes: resumes.length > 0, topics: topics.mastery.length > 0, communicationDimensions: false },
  };
  result.recommendations = recommendations({ summary, topics, consistency, roleReadiness: roles });
  result.narrative = buildNarrative(summary, topics, consistency);
  setCachedAnalytics(key, result);
  return result;
};

export const compareOwnedInterviews = async (userId, ids) => {
  const interviews = await Interview.find({ _id: { $in: ids }, user: userId }).select("role difficulty interviewType score duration questions answers generatedQuestions evaluations completedAt").lean();
  if (interviews.length !== ids.length) { const error = new Error("One or more interviews were not found or are not accessible"); error.statusCode = 403; throw error; }
  return interviews.map((item) => ({
    id: item._id, role: item.role, difficulty: item.difficulty, interviewType: item.interviewType, overallScore: item.score,
    durationMinutes: item.duration == null ? null : round(item.duration / 60), answerCompletion: percent((item.answers || []).filter((answer) => answer?.trim()).length, item.questions?.length || 0),
    categories: unique((item.generatedQuestions || []).map((question) => question.category)), strengths: latestEvaluation(item)?.strengths || [], weaknesses: latestEvaluation(item)?.improvements || [],
    questionScores: latestEvaluation(item)?.questions?.map((question) => ({ questionId: question.questionId, score: question.score * 10 })) || [], completedAt: item.completedAt,
  }));
};
