import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import Gamification from "../pages/Gamification";

const mocks = vi.hoisted(() => ({
  profile: vi.fn(), challenges: vi.fn(), badges: vi.fn(), history: vi.fn(),
  leaderboard: vi.fn(), claim: vi.fn(), setPreference: vi.fn(),
}));
vi.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ preference: "dark", setPreference: mocks.setPreference }),
}));
vi.mock("../services/api", () => ({
  getGamificationProfile: mocks.profile,
  getGamificationChallenges: mocks.challenges,
  getGamificationBadges: mocks.badges,
  getGamificationHistory: mocks.history,
  getGamificationLeaderboard: mocks.leaderboard,
  claimGamificationChallenge: mocks.claim,
}));

const profile = {
  xp: 300, level: 2, xpPerLevel: 250, currentLevelXp: 50,
  nextLevelXp: 500, levelProgress: 20, currentStreak: 3,
  longestStreak: 7, earnedBadges: 1, totalBadges: 2, availableRewards: 1,
};
const challenge = {
  key: "daily_questions", type: "daily", title: "Question Sprint",
  description: "Answer 5 questions", progress: 5, target: 5, xp: 25,
  completed: true, claimed: false,
};

beforeEach(() => {
  mocks.profile.mockResolvedValue({ data: { profile, xpRules: { questionAnswered: 5 } } });
  mocks.challenges.mockResolvedValue({ data: { challenges: [challenge, { ...challenge, key: "weekly_questions", type: "weekly", title: "Weekly Practice" }] } });
  mocks.badges.mockResolvedValue({ data: { badges: [{ key: "first", icon: "01", name: "First Interview", description: "Complete one", earned: true, earnedAt: "2026-07-01", progress: 1, target: 1 }] } });
  mocks.history.mockResolvedValue({ data: { history: [{ id: "h1", title: "Questions answered", occurredAt: "2026-07-01", xpAwarded: 25 }] } });
  mocks.leaderboard.mockResolvedValue({ data: { leaderboard: [{ userId: "u1", rank: 1, name: "Naiyar", level: 2, xp: 300, isCurrentUser: true }] } });
  mocks.claim.mockResolvedValue({ success: true });
});

describe("Phase 15 gamification page", () => {
  test("renders progression, missions, badges, leaderboard and history", async () => {
    render(<MemoryRouter><Gamification /></MemoryRouter>);
    expect(await screen.findByRole("heading", { level: 1, name: "Level 2" })).toBeInTheDocument();
    expect(screen.getByText("Daily challenges")).toBeInTheDocument();
    expect(screen.getByText("Weekly missions")).toBeInTheDocument();
    expect(screen.getByText("Achievement gallery")).toBeInTheDocument();
    expect(screen.getByText("Internal leaderboard")).toBeInTheDocument();
    expect(screen.getByText("Reward history")).toBeInTheDocument();
  });

  test("claims a completed challenge and refreshes the data", async () => {
    render(<MemoryRouter><Gamification /></MemoryRouter>);
    fireEvent.click((await screen.findAllByRole("button", { name: "Claim reward" }))[0]);
    await waitFor(() => expect(mocks.claim).toHaveBeenCalledWith("daily_questions"));
    expect(await screen.findByText("Reward claimed successfully.")).toBeInTheDocument();
  });
});
