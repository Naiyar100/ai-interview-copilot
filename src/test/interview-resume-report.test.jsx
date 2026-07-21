import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import InterviewSetupForm from "../components/Interview/InterviewSetupForm";
import Resumes from "../pages/Resumes";
import InterviewReport from "../pages/InterviewReport";

const mocks = vi.hoisted(() => ({
  createInterview: vi.fn(), generateInterviewQuestions: vi.fn(), getResumes: vi.fn(),
  uploadResume: vi.fn(), setActiveResume: vi.fn(), deleteResume: vi.fn(),
  getInterviewEvaluations: vi.fn(), reevaluateInterview: vi.fn(),
}));
vi.mock("../services/api", () => mocks);

beforeEach(() => Object.values(mocks).forEach((mock) => mock.mockReset()));

describe("interview, resume and report flows", () => {
  test("creates an interview, generates AI questions, and opens the session", async () => {
    const user = userEvent.setup();
    mocks.getResumes.mockResolvedValue({ data: { resumes: [] } });
    mocks.createInterview.mockResolvedValue({ data: { interview: { id: "interview-1" } } });
    mocks.generateInterviewQuestions.mockResolvedValue({ data: { questions: [] } });
    render(
      <MemoryRouter initialEntries={["/interview/setup"]}>
        <Routes>
          <Route path="/interview/setup" element={<InterviewSetupForm />} />
          <Route path="/interview/session/:id" element={<h1>Interview session</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: /Start Interview/ }));
    expect(mocks.createInterview).toHaveBeenCalledWith(expect.objectContaining({ role: "Frontend Developer", questionCount: 5 }));
    expect(mocks.generateInterviewQuestions).toHaveBeenCalledWith("interview-1");
    expect(await screen.findByText("Interview session")).toBeInTheDocument();
  });

  test("uploads a resume and displays progress/success", async () => {
    const user = userEvent.setup();
    mocks.getResumes
      .mockResolvedValueOnce({ data: { resumes: [] } })
      .mockResolvedValueOnce({ data: { resumes: [] } });
    mocks.uploadResume.mockImplementation(async (file, onProgress) => {
      onProgress(100);
      return { data: { file } };
    });
    render(<MemoryRouter><Resumes /></MemoryRouter>);
    await screen.findByText("No resumes uploaded");
    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText(/Upload PDF Resume/), file);
    expect(mocks.uploadResume).toHaveBeenCalled();
    expect(await screen.findByText(/Resume uploaded, analyzed/)).toBeInTheDocument();
  });

  test("renders stored AI evaluation feedback", async () => {
    mocks.getInterviewEvaluations.mockResolvedValue({ data: {
      interview: { role: "Frontend Developer", experienceLevel: "Fresher", difficulty: "Medium", interviewType: "Technical" },
      evaluations: [{
        id: "report-1", overallScore: 86, summary: "Strong result", strengths: ["Clarity"], improvements: ["More examples"], evaluatedAt: "2026-07-18T10:00:00Z",
        questions: [{ questionId: 1, score: 9, question: "Explain React keys", answer: "Stable identity", feedback: "Correct", idealAnswer: "Use stable IDs", topicsToStudy: ["Reconciliation"] }],
      }],
    } });
    render(<MemoryRouter initialEntries={["/interview/report/interview-1"]}><Routes><Route path="/interview/report/:id" element={<InterviewReport />} /></Routes></MemoryRouter>);
    expect(await screen.findByText("Strong result")).toBeInTheDocument();
    expect(screen.getByText("Correct")).toBeInTheDocument();
    expect(screen.getByText("Reconciliation")).toBeInTheDocument();
  });
});
