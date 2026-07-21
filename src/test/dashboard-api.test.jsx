import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import DashboardHome from "../components/Dashboard/DashboardHome";

const mocks = vi.hoisted(() => ({
  getDashboardOverview: vi.fn(), updateDashboardGoal: vi.fn(), deleteInterview: vi.fn(),
  createScheduledInterview: vi.fn(), updateScheduledInterview: vi.fn(), cancelScheduledInterview: vi.fn(),
  logout: vi.fn(), setPreference: vi.fn(),
}));
vi.mock("../services/api", () => ({
  getDashboardOverview: mocks.getDashboardOverview,
  updateDashboardGoal: mocks.updateDashboardGoal,
  deleteInterview: mocks.deleteInterview,
  createScheduledInterview: mocks.createScheduledInterview,
  updateScheduledInterview: mocks.updateScheduledInterview,
  cancelScheduledInterview: mocks.cancelScheduledInterview,
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { name: "Test Person" }, logout: mocks.logout }) }));
vi.mock("../context/ThemeContext", () => ({ useTheme: () => ({ preference: "system", setPreference: mocks.setPreference }) }));

const day = (date) => ({ date, interviewsCompleted: 0, questionsAnswered: 0, averageScore: null, practiceMinutes: 0, activityCount: 0 });
const overview = {
  user: { firstName: "Test", targetRole: "Frontend Developer" },
  summary: { totalInterviews: 4, completedInterviews: 3, averageScore: 82, highestScore: 91, questionsAnswered: 16, totalPracticeMinutes: 42, currentStreak: 2, longestStreak: 4, activeToday: true, evaluatedInterviews: 2, thisWeek: { completed: 1, questions: 5, minutes: 12 }, resumeScore: null },
  dailyGoal: { type: "questions", target: 5, progress: 3, percentage: 60, completed: false, timezone: "UTC", resetsAt: "2026-07-19" },
  continueInterview: { id: "draft-1", role: "Frontend Developer", difficulty: "Medium", interviewType: "Technical", status: "draft", answeredQuestions: 2, totalQuestions: 5, updatedAt: new Date().toISOString() },
  weeklyProgress: ["2026-07-12", "2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16", "2026-07-17", "2026-07-18"].map((date, index) => ({ ...day(date), questionsAnswered: index === 6 ? 3 : 0 })),
  heatmap: Array.from({ length: 84 }, (_, index) => { const date = new Date("2026-04-26T12:00:00Z"); date.setUTCDate(date.getUTCDate() + index); return { date: date.toISOString().slice(0, 10), count: index === 83 ? 3 : 0, activityCount: index === 83 ? 3 : 0 }; }),
  recentInterviews: [{ id: "draft-1", role: "Frontend Developer", interviewType: "Technical", difficulty: "Medium", status: "draft", score: null, durationMinutes: 0, answeredQuestions: 2, totalQuestions: 5, createdAt: "2026-07-18T10:00:00Z", updatedAt: "2026-07-18T11:00:00Z" }],
  activity: [{ id: "a1", type: "interview_created", title: "Interview created", description: "Frontend Developer", relatedEntityType: "interview", relatedEntityId: "draft-1", occurredAt: new Date().toISOString() }],
  weakTopics: [{ topic: "React state", score: 60, questionCount: 2 }],
  strongTopics: [{ topic: "JavaScript", score: 90, questionCount: 3 }],
  aiCoach: { primaryRecommendation: "Practice React state next.", weakTopic: { topic: "React state", score: 60, questionCount: 2 }, recentImprovement: 6, recommendedAction: { label: "Practice React state", path: "/interview/setup" } },
  gamification: { xp: 340, level: 2, currentLevelXp: 90, xpForNextLevel: 250, nextLevelXp: 500, percentage: 36 },
  badges: [{ key: "first_interview", name: "First Interview", description: "Complete one", icon: "01", earned: true, progress: 1, target: 1 }],
  upcomingInterviews: [], calendarActivity: [{ date: "2026-07-18", count: 3, activityCount: 3 }], activeResume: null,
};

describe("premium dashboard", () => {
  beforeEach(() => Object.values(mocks).forEach((mock) => mock.mockReset()));

  test("shows a skeleton and renders authenticated real-data widgets", async () => {
    mocks.getDashboardOverview.mockResolvedValue({ data: overview });
    render(<MemoryRouter><DashboardHome /></MemoryRouter>);
    expect(screen.getByRole("status", { name: "Loading dashboard" })).toBeInTheDocument();
    expect(await screen.findByText(/Test, let's build interview confidence/)).toBeInTheDocument();
    expect(screen.getAllByText("Frontend Developer").length).toBeGreaterThan(0);
    expect(screen.getByText("Practice React state next.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Resume" })[0]).toHaveAttribute("href", "/interview/session/draft-1");
    expect(screen.getByText("Weekly progress")).toBeInTheDocument();
  });

  test("renders polished empty states", async () => {
    mocks.getDashboardOverview.mockResolvedValue({ data: {
      ...overview,
      summary: { ...overview.summary, totalInterviews: 0, completedInterviews: 0, evaluatedInterviews: 0, questionsAnswered: 0 },
      continueInterview: null, recentInterviews: [], activity: [], weakTopics: [], strongTopics: [],
      weeklyProgress: overview.weeklyProgress.map((item) => ({ ...item, questionsAnswered: 0 })),
      heatmap: overview.heatmap.map((item) => ({ ...item, count: 0, activityCount: 0 })),
    } });
    render(<MemoryRouter><DashboardHome /></MemoryRouter>);
    expect(await screen.findByText("No interview in progress")).toBeInTheDocument();
    expect(screen.getByText("No interviews yet")).toBeInTheDocument();
    expect(screen.getByText("No activity this week")).toBeInTheDocument();
  });

  test("shows API failure and retries", async () => {
    const user = userEvent.setup();
    mocks.getDashboardOverview.mockRejectedValueOnce(new Error("Network unavailable")).mockResolvedValue({ data: overview });
    render(<MemoryRouter><DashboardHome /></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Weekly progress")).toBeInTheDocument();
    expect(mocks.getDashboardOverview).toHaveBeenCalledTimes(2);
  });

  test("switches centralized theme preference from the header", async () => {
    const user = userEvent.setup();
    mocks.getDashboardOverview.mockResolvedValue({ data: overview });
    render(<MemoryRouter><DashboardHome /></MemoryRouter>);
    await screen.findByText("Weekly progress");
    await user.selectOptions(screen.getByLabelText("Color theme"), "dark");
    expect(mocks.setPreference).toHaveBeenCalledWith("dark");
  });

  test("updates the daily goal and refreshes dashboard data", async () => {
    const user = userEvent.setup();
    mocks.getDashboardOverview.mockResolvedValue({ data: overview });
    mocks.updateDashboardGoal.mockResolvedValue({ data: { goal: { target: 8 } } });
    render(<MemoryRouter><DashboardHome /></MemoryRouter>);
    await screen.findByText("Weekly progress");
    await user.click(screen.getByRole("button", { name: "Edit daily goal" }));
    const target = screen.getByLabelText("Questions per day");
    await user.clear(target);
    await user.type(target, "8");
    await user.click(screen.getByRole("button", { name: "Save goal" }));
    expect(mocks.updateDashboardGoal).toHaveBeenCalledWith(expect.objectContaining({ target: 8 }));
    expect(await screen.findByText("Daily goal updated.")).toBeInTheDocument();
  });

  test("confirms and deletes a recent owned interview", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.getDashboardOverview.mockResolvedValue({ data: overview });
    mocks.deleteInterview.mockResolvedValue({ success: true });
    render(<MemoryRouter><DashboardHome /></MemoryRouter>);
    await screen.findByText("Weekly progress");
    await user.click(screen.getByRole("button", { name: "Delete Frontend Developer interview" }));
    expect(mocks.deleteInterview).toHaveBeenCalledWith("draft-1");
  });
});
