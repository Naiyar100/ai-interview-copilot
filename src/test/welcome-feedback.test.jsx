import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import LoginForm from "../components/Auth/LoginForm";
import SignupForm from "../components/Auth/SignupForm";
import WelcomeFeedbackModal, {
  WELCOME_DISMISSED_KEY,
} from "../components/Feedback/WelcomeFeedbackModal";
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

describe("welcome and feedback modal", () => {
  beforeEach(() => {
    apiMocks.apiRequest.mockReset();
    apiMocks.submitFeedback.mockReset();
    apiMocks.apiRequest.mockResolvedValue(authenticatedResponse);
  });

  test("opens in the dashboard after successful login and closes with Escape", async () => {
    const user = userEvent.setup();
    render(<AuthFlow />);

    await login(user);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Dashboard loaded")).toBeInTheDocument();
    expect(screen.getByText(/Welcome to AI Interview Copilot/)).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(localStorage.getItem(WELCOME_DISMISSED_KEY)).toBe("true");
  });

  test("opens after signup and the close button persists dismissal", async () => {
    const user = userEvent.setup();
    render(<AuthFlow initialPath="/signup" />);

    await user.type(screen.getByLabelText("Name"), "Naiyar");
    await user.type(screen.getByLabelText("Email"), "naiyar@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.type(screen.getByLabelText("Confirm Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign up" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close welcome message" }));
    expect(localStorage.getItem(WELCOME_DISMISSED_KEY)).toBe("true");
  });

  test("does not open for unauthenticated visitors or after dismissal", async () => {
    localStorage.setItem(WELCOME_DISMISSED_KEY, "true");
    const user = userEvent.setup();
    const { unmount } = render(<AuthFlow initialPath="/dashboard" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();

    render(<AuthFlow />);
    await login(user);
    expect(await screen.findByText("Dashboard loaded")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("shows the updated popup when only the previous version was dismissed", async () => {
    localStorage.setItem("ai-interview-copilot-welcome-v1-dismissed", "true");
    const user = userEvent.setup();
    render(<AuthFlow />);

    await login(user);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  test("validates and successfully submits feedback", async () => {
    const user = userEvent.setup();
    apiMocks.submitFeedback.mockResolvedValue({ success: true });
    render(<AuthFlow />);
    await login(user);
    await user.click(await screen.findByRole("button", { name: "Give Feedback" }));

    await user.click(screen.getByRole("button", { name: "Submit feedback" }));
    expect(screen.getByText("Choose a rating from 1 to 5.")).toBeInTheDocument();
    expect(screen.getByText("Tell us what you liked.")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "5 out of 5" }));
    await user.type(screen.getByLabelText(/What did you like/), "The interview flow");
    await user.type(screen.getByLabelText(/What should be improved/), "More mobile spacing");
    await user.click(screen.getByRole("button", { name: "Submit feedback" }));

    await waitFor(() => expect(apiMocks.submitFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        rating: 5,
        liked: "The interview flow",
        improvements: "More mobile spacing",
        foundBug: false,
      }),
    ));
    expect(await screen.findByText("Thank you!")).toBeInTheDocument();
  });

  test("shows a friendly submission error and allows cancellation", async () => {
    const user = userEvent.setup();
    apiMocks.submitFeedback.mockRejectedValue(new Error("Network failure"));
    render(<AuthFlow />);
    await login(user);
    await user.click(await screen.findByRole("button", { name: "Give Feedback" }));
    await user.click(screen.getByRole("radio", { name: "4 out of 5" }));
    await user.type(screen.getByLabelText(/What did you like/), "Reports");
    await user.type(screen.getByLabelText(/What should be improved/), "Loading speed");
    await user.click(screen.getByRole("button", { name: "Submit feedback" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your feedback could not be submitted right now",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText(/Welcome to AI Interview Copilot/)).toBeInTheDocument();
  });
});
