import Interview from "../../models/Interview.js";
import Resume from "../../models/Resume.js";
import { calculateTopicInsights } from "../dashboard/topicInsightsService.js";

const compactList = (items = [], limit = 8) => [...new Set(items.map((item) => String(item).trim()).filter(Boolean))].slice(0, limit);

export const buildCoachContext = async (user) => {
  const [interviews, resume] = await Promise.all([
    Interview.find({ user: user._id }).select("role experienceLevel difficulty interviewType status score duration generatedQuestions evaluations completedAt createdAt").sort({ createdAt: -1 }).limit(20).lean(),
    Resume.findOne({ user: user._id, isActive: true }).select("summary updatedAt").lean(),
  ]);
  const evaluated = interviews.filter((item) => item.evaluations?.length);
  const topicInsights = calculateTopicInsights(evaluated);
  const completed = interviews.filter((item) => item.status === "completed");
  const scores = completed.map((item) => item.score).filter(Number.isFinite);
  const roleCounts = interviews.reduce((map, item) => map.set(item.role, (map.get(item.role) || 0) + 1), new Map());
  const targetRole = [...roleCounts].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return {
    user: { name: user.name, targetRole },
    resume: resume ? {
      skills: compactList(resume.summary?.skills), technologies: compactList(resume.summary?.technologies),
      projects: compactList(resume.summary?.projects, 5), experience: compactList(resume.summary?.experience, 5),
      education: compactList(resume.summary?.education, 4), certifications: compactList(resume.summary?.certifications, 4), updatedAt: resume.updatedAt,
    } : null,
    analytics: {
      totalInterviews: interviews.length, completedInterviews: completed.length, evaluatedInterviews: evaluated.length,
      averageScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
      strongestTopics: topicInsights.strongTopics.map(({ topic, score, questionCount }) => ({ topic, score, evidenceCount: questionCount })),
      weakestTopics: topicInsights.weakTopics.map(({ topic, score, questionCount }) => ({ topic, score, evidenceCount: questionCount })),
    },
    interviewHistory: interviews.slice(0, 10).map((item) => ({
      role: item.role, experienceLevel: item.experienceLevel, difficulty: item.difficulty,
      interviewType: item.interviewType, status: item.status, score: item.score,
      completedAt: item.completedAt, createdAt: item.createdAt,
    })),
    evaluationHistory: evaluated.slice(0, 6).map((item) => {
      const evaluation = item.evaluations.at(-1);
      return { role: item.role, score: evaluation.overallScore, summary: evaluation.summary.slice(0, 500), strengths: compactList(evaluation.strengths, 5), improvements: compactList(evaluation.improvements, 5), evaluatedAt: evaluation.evaluatedAt };
    }),
  };
};
