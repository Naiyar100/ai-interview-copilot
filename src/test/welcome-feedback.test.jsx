import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import LoginForm from "../components/Auth/LoginForm";
import SignupForm from "../components/Auth/SignupForm";
import WelcomeFeedbackModal from "../components/Feedback/WelcomeFeedbackModal";
import AuthProvider from "../context/AuthProvider";

const apiMocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  submitFeedback: vi.fn(),
}));

vi.mock("../services/api", () => apiMocks);

const authenticatedResponse = {
  data: {
    token: "test-token",
    user: { id: "user-1", name: "Naiyar", email: "naiyar@example.com" },
  },
};

function AuthFlow({ initialPath = "/login" }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginForm />} />
          <Route path="/signup" element={<SignupForm />} />
          <Route path="/dashboard" element={<h1>Dashboard loaded</h1>} />
        </Routes>
        <WelcomeFeedbackModal />
      </AuthProvider>
    </MemoryRouter>
  );
}

const login = async (user) => {
  await user.type(screen.getByLabelText("Email"), "naiyar@example.com");
  await user.type(screen.getByLabelText("Password"), "secret123");
  await user.click(screen.getByRole("button", { name: "Login" }));
};

describe("welcome and feedback flow", () => {
  beforeEach(() => {
    apiMocks.apiRequest.mockReset();
    apiMocks.submitFeedback.mockReset();
    apiMocks.apiRequest.mockResolvedValue(authenticatedResponse);
  });

  test("opens after every successful login without using dismissal storage", async () => {
    localStorage.setItem("ai-interview-copilot-welcome-v1-dismissed", "true");
    localStorage.setItem("ai-interview-copilot-welcome-v2-dismissed", "true");
    const user = userEvent.setup();
    const first = render(<AuthFlow />);

    await login(user);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Explore the App" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Give feedback about/ })).toBeVisible();

    first.unmount();
    localStorage.removeItem("authToken");
    render(<AuthFlow />);
    await login(user);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  test("opens after successful signup", async () => {
    const user = userEvent.setup();
    render(<AuthFlow initialPath="/signup" />);

    await user.type(screen.getByLabelText("Name"), "Naiyar");
    await user.type(screen.getByLabelText("Email"), "naiyar@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.type(screen.getByLabelText("Confirm Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign up" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Dashboard loaded")).toBeInTheDocument();
  });

  test("does not open for unauthenticated visitors", () => {
    render(<AuthFlow initialPath="/dashboard" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Give feedback about/ })).not.toBeInTheDocument();
  });

  test("close and Escape keep permanent feedback available", async () => {
    const user = userEvent.setup();
    const first = render(<AuthFlow />);
    await login(user);
    await user.click(await screen.findByRole("button", { name: "Close welcome message" }));
    expect(screen.getByRole("button", { name: /Give feedback about/ })).toBeVisible();

    first.unmount();
    localStorage.removeItem("authToken");
    render(<AuthFlow />);
    await login(user);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Give feedback about/ })).toBeVisible();
  });

  test("opens the simplified form with prefilled details and validates it", async () => {
    const user = userEvent.setup();
    render(<AuthFlow />);
    await login(user);
    await user.click(await screen.findByRole("button", { name: "Give Feedback" }));

    expect(screen.getByLabelText(/Name/)).toHaveValue("Naiyar");
    expect(screen.getByLabelText(/Email/)).toHaveValue("naiyar@example.com");
    await user.click(screen.getByRole("button", { name: "Submit feedback" }));
    expect(screen.getByText("Enter your feedback.")).toBeInTheDocument();
  });

  test("successfully submits from the permanent feedback trigger", async () => {
    const user = userEvent.setup();
    apiMocks.submitFeedback.mockResolvedValue({ success: true });
    render(<AuthFlow />);
    await login(user);
    await user.click(await screen.findByRole("button", { name: "Explore the App" }));
    await user.click(screen.getByRole("button", { name: /Give feedback about/ }));
    await user.type(screen.getByLabelText(/Feedback/), "The interview flow is helpful.");
    await user.click(screen.getByRole("button", { name: "Submit feedback" }));

    await waitFor(() =>
      expect(apiMocks.submitFeedback).toHaveBeenCalledWith({
        name: "Naiyar",
        email: "naiyar@example.com",
        feedback: "The interview flow is helpful.",
      }),
    );
    expect(await screen.findByText("Thank you!")).toBeInTheDocument();
  });

  test("shows submission errors and allows cancellation", async () => {
    const user = userEvent.setup();
    apiMocks.submitFeedback.mockRejectedValue(new Error("Network failure"));
    render(<AuthFlow />);
    await login(user);
    await user.click(await screen.findByRole("button", { name: "Give Feedback" }));
    await user.type(screen.getByLabelText(/Feedback/), "Please improve loading speed.");
    await user.click(screen.getByRole("button", { name: "Submit feedback" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your feedback could not be submitted right now",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText(/Welcome to AI Interview Copilot/)).toBeInTheDocument();
  });
});
