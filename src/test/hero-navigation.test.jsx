import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import Hero from "../components/Hero/Hero";

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: false },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => mocks.auth,
}));

const renderHero = () =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Hero />} />
        <Route path="/login" element={<h1>Login page</h1>} />
        <Route path="/dashboard" element={<h1>Dashboard page</h1>} />
      </Routes>
    </MemoryRouter>,
  );

describe("landing page Start Interview action", () => {
  beforeEach(() => {
    mocks.auth.isAuthenticated = false;
  });

  test("sends unauthenticated visitors to login", async () => {
    const user = userEvent.setup();
    renderHero();
    await user.click(screen.getByRole("button", { name: /Start Interview/ }));
    expect(screen.getByRole("heading", { name: "Login page" })).toBeInTheDocument();
  });

  test("sends authenticated users to the dashboard", async () => {
    const user = userEvent.setup();
    mocks.auth.isAuthenticated = true;
    renderHero();
    await user.click(screen.getByRole("button", { name: /Start Interview/ }));
    expect(screen.getByRole("heading", { name: "Dashboard page" })).toBeInTheDocument();
  });
});
