import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import Resumes from "../pages/Resumes";

const mocks = vi.hoisted(() => ({ getResumes: vi.fn(), uploadResume: vi.fn(), activate: vi.fn(), remove: vi.fn(), analyze: vi.fn(), compare: vi.fn(), improve: vi.fn(), export: vi.fn(), download: vi.fn(), setPreference: vi.fn() }));
vi.mock("../services/api", () => ({ getResumes: mocks.getResumes, uploadResume: mocks.uploadResume, setActiveResume: mocks.activate, deleteResume: mocks.remove, analyzeResumeForAts: mocks.analyze, compareResumeVersions: mocks.compare, improveResumeWithAi: mocks.improve, exportResumeReview: mocks.export, downloadBase64File: mocks.download }));
vi.mock("../context/ThemeContext", () => ({ useTheme: () => ({ preference: "dark", setPreference: mocks.setPreference }) }));

const analysis = { id: "a1", resumeId: "r1", targetRole: "Frontend Developer", analyzedAt: "2026-07-22", scores: { ats: 82, resume: 79, keyword: 75, structure: 90, content: 74, readability: 88 }, keywordAnalysis: { coverage: 75, matched: [{ keyword: "react", count: 3 }], missing: ["typescript", "testing"] }, missingSkills: ["typescript", "testing"], actionVerbSuggestions: [{ weak: "worked on", replacement: "Developed", reason: "Be specific" }], strengths: ["Clear sections"], issues: [{ category: "keywords", severity: "medium", message: "Add testing evidence" }], aiSuggestions: [] };
const resumes = [
  { id: "r1", originalFileName: "resume-v1.pdf", version: 1, fileSize: 1000, uploadDate: "2026-07-20", isActive: true, extractionStatus: "ready", summary: { skills: ["React"], technologies: ["JavaScript"], projects: [], experience: [] }, latestAnalysis: analysis },
  { id: "r2", originalFileName: "resume-v2.pdf", version: 2, fileSize: 1200, uploadDate: "2026-07-22", isActive: false, extractionStatus: "ready", summary: { skills: ["React", "TypeScript"], technologies: ["JavaScript"], projects: ["App"], experience: ["Developer"] }, latestAnalysis: { ...analysis, id: "a2", resumeId: "r2", scores: { ...analysis.scores, ats: 88 } } },
];

describe("Phase 14 ATS Resume Reviewer UI", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset()); mocks.getResumes.mockResolvedValue({ data: { resumes } });
    mocks.analyze.mockResolvedValue({ data: { analysis } }); mocks.improve.mockResolvedValue({ data: { analysis: { ...analysis, aiSuggestions: [{ type: "experience", title: "Quantify impact", reason: "Show evidence", example: "Improved [metric] by [percentage]", priority: "high" }] } } });
    mocks.compare.mockResolvedValue({ data: { recommendedResumeId: "r2", comparison: [{ resumeId: "r1", version: 1, scores: analysis.scores, changeFromFirst: { ats: 0 } }, { resumeId: "r2", version: 2, scores: { ...analysis.scores, ats: 88 }, changeFromFirst: { ats: 6 } }] } });
    mocks.export.mockResolvedValue({ data: { filename: "report.pdf", mimeType: "application/pdf", contentBase64: "JVBERg==" } });
  });

  test("renders scores, keyword gaps, version history, and theme control", async () => {
    render(<MemoryRouter><Resumes /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Build a resume that gets understood" })).toBeInTheDocument();
    expect(await screen.findByText("Resume versions")).toBeInTheDocument();
    expect(screen.getAllByText("82").length).toBeGreaterThan(0); expect(screen.getAllByText("typescript").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Color theme")).toHaveValue("dark");
  });

  test("runs targeted analysis and AI improvement", async () => {
    const user = userEvent.setup(); render(<MemoryRouter><Resumes /></MemoryRouter>); await screen.findByText("Resume versions");
    await user.type(screen.getByPlaceholderText("e.g. Frontend Developer"), "Frontend Developer");
    await user.type(screen.getByPlaceholderText("Paste the target job description for keyword matching"), "React testing TypeScript");
    await user.click(screen.getByRole("button", { name: "Run ATS analysis" }));
    expect(mocks.analyze).toHaveBeenCalledWith("r1", "Frontend Developer", "React testing TypeScript");
    await user.click(screen.getByRole("button", { name: "Generate suggestions" }));
    expect(await screen.findByText("Quantify impact")).toBeInTheDocument();
  });

  test("compares selected versions and exports a report", async () => {
    const user = userEvent.setup(); render(<MemoryRouter><Resumes /></MemoryRouter>); await screen.findByText("Resume versions");
    const checks = screen.getAllByRole("checkbox"); await user.click(checks[0]); await user.click(checks[1]);
    await user.click(screen.getByRole("button", { name: "Compare selected (2)" }));
    expect(await screen.findByText("Recommended")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Export PDF" })); expect(mocks.download).toHaveBeenCalled();
  });
});
