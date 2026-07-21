import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import LoginForm from "../components/Auth/LoginForm";
import SignupForm from "../components/Auth/SignupForm";
import ProtectedRoute from "../components/Auth/ProtectedRoute";

const mocks = vi.hoisted(() => ({
  auth: { login: vi.fn(), register: vi.fn(), isAuthenticated: false, isLoading: false },
}));

vi.mock("../context/AuthContext", () => ({ useAuth: () => mocks.auth }));

describe("authentication UI", () => {
  beforeEach(() => {
    mocks.auth.login = vi.fn();
    mocks.auth.register = vi.fn();
    mocks.auth.isAuthenticated = false;
    mocks.auth.isLoading = false;
  });

  test("logs in and navigates to the dashboard", async () => {
    const user = userEvent.setup();
    mocks.auth.login.mockResolvedValue({ id: "1" });
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginForm />} />
          <Route path="/dashboard" element={<h1>Dashboard loaded</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    fireEvent.submit(screen.getByRole("button", { name: "Login" }).closest("form"));
    expect(mocks.auth.login).toHaveBeenCalledWith({ email: "person@example.com", password: "secret123" });
    expect(await screen.findByText("Dashboard loaded")).toBeInTheDocument();
  });

  test("shows login and signup validation errors", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<MemoryRouter><LoginForm /></MemoryRouter>);
    fireEvent.submit(screen.getByRole("button", { name: "Login" }).closest("form"));
    expect(screen.getByText("Please enter both email and password.")).toBeInTheDocument();
    unmount();

    render(<MemoryRouter><SignupForm /></MemoryRouter>);
    await user.type(screen.getByLabelText("Name"), "Test User");
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.type(screen.getByLabelText("Confirm Password"), "different");
    await user.click(screen.getByRole("button", { name: "Sign up" }));
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
  });

  test("protects routes and exposes an authentication loading state", () => {
    mocks.auth.isLoading = true;
    const { rerender } = render(
      <MemoryRouter><ProtectedRoute><h1>Private</h1></ProtectedRoute></MemoryRouter>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Checking authentication");

    mocks.auth.isLoading = false;
    mocks.auth.isAuthenticated = true;
    rerender(<MemoryRouter><ProtectedRoute><h1>Private</h1></ProtectedRoute></MemoryRouter>);
    expect(screen.getByText("Private")).toBeInTheDocument();
  });
});
