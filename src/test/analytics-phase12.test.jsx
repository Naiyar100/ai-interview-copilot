import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import Analytics from "../pages/Analytics";

const mocks = vi.hoisted(() => ({
  hook: vi.fn(), getViews: vi.fn(), getInterviews: vi.fn(), createView: vi.fn(), deleteView: vi.fn(),
  compare: vi.fn(), export: vi.fn(), download: vi.fn(), updateView: vi.fn(), setPreference: vi.fn(),
}));
vi.mock("../hooks/useAnalytics", () => ({ default: () => mocks.hook() }));
vi.mock("../context/ThemeContext", () => ({ useTheme: () => ({ preference: "dark", setPreference: mocks.setPreference }) }));
vi.mock("../services/api", () => ({
  getAnalyticsViews: mocks.getViews, getInterviews: mocks.getInterviews, createAnalyticsView: mocks.createView,
  deleteAnalyticsView: mocks.deleteView, compareAnalyticsInterviews: mocks.compare, exportAnalytics: mocks.export,
  downloadBase64File: mocks.download, updateAnalyticsView: mocks.updateView,
}));

const filters = { preset: "30d", startDate: "", endDate: "", role: "", interviewType: "", difficulty: "", status: "", category: "", resumeId: "", voiceMode: "", scoreMin: "", scoreMax: "", aggregation: "day", timezone: "UTC" };
const base = {
  range: { startDate: "2026-06-20", endDate: "2026-07-19", timezone: "UTC" },
  filters: { ...filters, available: { roles: [], categories: [], resumes: [] } },
  summary: { totalInterviews: 0, completedInterviews: 0, completionRate: 0, averageScore: null, highestScore: null, medianScore: null, questionsAnswered: 0, averageQuestionScore: null, totalPracticeMinutes: 0, currentStreak: 0, goalCompletionRate: 0, voiceUsageRate: 0, comparisons: {} },
  narrative: "No interviews match this range yet.", performanceTrend: [], activityTrend: [], skillRadar: [], topicMastery: [], topicHeatmap: [], strengths: [], weaknesses: [], difficultyAnalysis: [], interviewTypeAnalysis: [],
  answerQuality: { averageAnswerWords: null, averageQuestionScore: null, unansweredPercentage: 0, topicCoverage: 0, scoreDistribution: [], note: "Longer answers are not automatically better." },
  practiceTime: { totalMinutes: 0, averageSessionMinutes: null, longestSessionMinutes: null, mostActiveDay: null, byInterviewType: [] },
  voiceAnalytics: { interviews: 0, completed: 0, usageRate: 0, averageTranscriptWords: null, averageVoiceScore: null, note: "No raw audio." },
  resumeAnalytics: { currentScore: null, versions: 0, scoreChange: null, keywordCount: 0, note: "Not ATS." }, consistency: { weeklyConsistencyScore: 0, activeDays: 0 },
  roleReadiness: [], companyReadiness: [], gamification: { xp: { earnedInPeriod: 0, currentLevel: 1, progressToNextLevel: 0, sourceBreakdown: [] }, badges: { totalEarned: 0, categoryCompletion: 0 } }, recommendations: [],
  dataAvailability: { interviews: false, evaluations: false, voice: false, resumes: false }, generatedAt: "2026-07-19T10:00:00Z", cache: { hit: false },
};
const hookValue = (overrides = {}) => ({ data: base, filters, setFilter: vi.fn(), clearFilters: vi.fn(), applyView: vi.fn(), loading: false, refreshing: false, error: "", retry: vi.fn(), ...overrides });

describe("Phase 12 Analytics Center", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getViews.mockResolvedValue({ data: { views: [] } });
    mocks.getInterviews.mockResolvedValue({ data: { interviews: [] } });
  });

  test("shows an accessible loading skeleton", () => {
    mocks.hook.mockReturnValue(hookValue({ data: null, loading: true }));
    render(<MemoryRouter><Analytics /></MemoryRouter>);
    expect(screen.getByRole("status", { name: "Loading analytics" })).toBeInTheDocument();
  });

  test("renders the dedicated new-user empty state without meaningless charts", async () => {
    mocks.hook.mockReturnValue(hookValue());
    render(<MemoryRouter><Analytics /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Analytics Center" })).toBeInTheDocument();
    expect(screen.getByText("Your analytics journey starts with an interview")).toBeInTheDocument();
    expect(screen.queryByText("Score trend")).not.toBeInTheDocument();
  });

  test("renders real analytics, recommendations, readiness disclaimer, and filter interactions", async () => {
    const user = userEvent.setup();
    const setFilter = vi.fn(); const clearFilters = vi.fn();
    const data = {
      ...base, filters: { ...base.filters, available: { roles: ["Frontend Developer"], categories: ["React"], resumes: [] } },
      summary: { ...base.summary, totalInterviews: 3, completedInterviews: 2, completionRate: 67, averageScore: 82, highestScore: 90, medianScore: 82, questionsAnswered: 10, averageQuestionScore: 81, totalPracticeMinutes: 35, comparisons: { averageScore: { absolute: 6, direction: "up" } } },
      narrative: "You completed 2 of 3 interviews with an 82% average score.",
      performanceTrend: [{ period: "2026-07-01", overallScore: 82, sampleSize: 2 }],
      activityTrend: [{ period: "2026-07-01", interviewsCompleted: 2 }],
      topicMastery: [{ topic: "React", averageScore: 82, attempts: 4, mastery: "Strong", confidence: "Medium", trend: 5, nextAction: "Try a harder React interview", lastPracticedAt: "2026-07-18" }],
      topicHeatmap: [{ topic: "React", period: "2026-07-14", attempts: 2, averageScore: 82 }], strengths: [], weaknesses: [],
      difficultyAnalysis: [{ value: "Medium", interviews: 3, averageScore: 82, completionRate: 67, averageDurationMinutes: 17, trend: 5 }],
      interviewTypeAnalysis: [{ value: "Technical", interviews: 3, averageScore: 82, completionRate: 67, averageDurationMinutes: 17, trend: 5 }],
      answerQuality: { ...base.answerQuality, averageAnswerWords: 32, averageQuestionScore: 81, topicCoverage: 4, scoreDistribution: [{ label: "80-89", count: 2 }] },
      practiceTime: { ...base.practiceTime, totalMinutes: 35, averageSessionMinutes: 17, longestSessionMinutes: 20, mostActiveDay: "Monday", byInterviewType: [{ label: "Technical", minutes: 35 }] },
      communicationTechnical: { technicalScore: 81, communicationScore: null, clarityScore: null, completenessScore: null, note: "Separate dimensions are not stored." },
      roleReadiness: [{ role: "Frontend Developer", readinessScore: 72, readinessLevel: "Interview Ready", confidence: "Medium", nextSteps: ["Add hard exposure"] }],
      companyReadiness: [{ company: "Google", readinessScore: 70, confidence: "Medium", evidenceCount: 2 }],
      gamification: { xp: { earnedInPeriod: 100, currentLevel: 2, progressToNextLevel: 40, sourceBreakdown: [{ type: "interview_completed", xp: 100 }] }, badges: { totalEarned: 2, categoryCompletion: 25 } },
      recommendations: [{ title: "Strengthen React", explanation: "Practice focused questions", evidence: "82% across 4 attempts", priority: "Medium", actionLabel: "Start focused practice", actionRoute: "/interview/setup" }],
      dataAvailability: { interviews: true, evaluations: true, voice: false, resumes: false },
    };
    mocks.hook.mockReturnValue(hookValue({ data, setFilter, clearFilters }));
    render(<MemoryRouter><Analytics /></MemoryRouter>);
    expect(await screen.findByText("Score trend")).toBeInTheDocument();
    expect(screen.getByText("Topic mastery")).toBeInTheDocument();
    expect(screen.getByText(/Readiness is an estimate/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.selectOptions(screen.getByLabelText("Difficulty"), "Hard");
    expect(setFilter).toHaveBeenCalledWith("difficulty", "Hard");
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(clearFilters).toHaveBeenCalled();
  });
});
