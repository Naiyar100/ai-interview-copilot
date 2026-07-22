import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import Coach from "../pages/Coach";
import MarkdownMessage from "../components/Coach/MarkdownMessage";

const mocks = vi.hoisted(() => ({ getChats: vi.fn(), getChat: vi.fn(), update: vi.fn(), remove: vi.fn(), stream: vi.fn(), setPreference: vi.fn() }));
vi.mock("../services/api", () => ({
  getCoachChats: mocks.getChats, getCoachChat: mocks.getChat, updateCoachChat: mocks.update,
  deleteCoachChat: mocks.remove, streamCoachMessage: mocks.stream,
}));
vi.mock("../context/ThemeContext", () => ({ useTheme: () => ({ preference: "dark", setPreference: mocks.setPreference }) }));

const summary = { id: "chat-1", title: "React plan", pinned: false, messageCount: 2, preview: "Practice React", lastMessageAt: "2026-07-22T10:00:00Z" };
const chat = { ...summary, messages: [{ id: "m1", role: "user", content: "Help me", createdAt: "2026-07-22T10:00:00Z" }, { id: "m2", role: "assistant", content: "## Plan\nPractice **React**.", createdAt: "2026-07-22T10:00:01Z" }] };

describe("Phase 13 Career Coach UI", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getChats.mockResolvedValue({ data: { chats: [summary] } });
    mocks.getChat.mockResolvedValue({ data: { chat } });
    mocks.update.mockResolvedValue({ data: { chat: { ...summary, pinned: true } } });
    mocks.remove.mockResolvedValue({ success: true });
    Element.prototype.scrollIntoView = vi.fn();
  });

  test("renders suggestions and streams a new response into the chat", async () => {
    const user = userEvent.setup();
    mocks.getChats.mockResolvedValue({ data: { chats: [] } });
    mocks.stream.mockImplementation(async ({ onEvent }) => {
      onEvent("meta", { chatId: "new-chat", title: "Practice plan" });
      onEvent("chunk", { text: "Start with " });
      onEvent("chunk", { text: "React." });
      onEvent("done", { chat: { id: "new-chat", title: "Practice plan", messages: [{ id: "u", role: "user", content: "Make a plan" }, { id: "a", role: "assistant", content: "Start with React." }] } });
    });
    render(<MemoryRouter><Coach /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Your personal AI Career Coach" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Message Career Coach"), "Make a plan");
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("Start with React.")).toBeInTheDocument();
    expect(mocks.stream).toHaveBeenCalledWith(expect.objectContaining({ message: "Make a plan", regenerate: false }));
  });

  test("loads a saved chat and supports search, pin, and delete", async () => {
    const user = userEvent.setup(); vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<MemoryRouter><Coach /></MemoryRouter>);
    await user.click(await screen.findByText("React plan"));
    expect(await screen.findByRole("heading", { name: "Plan" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search conversations"), "React");
    expect(await screen.findByDisplayValue("React")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pin React plan" }));
    expect(mocks.update).toHaveBeenCalledWith("chat-1", { pinned: true });
    await user.click(screen.getByRole("button", { name: "Delete React plan" }));
    expect(mocks.remove).toHaveBeenCalledWith("chat-1");
  });

  test("renders markdown and code safely without injecting HTML", () => {
    const { container } = render(<MarkdownMessage content={'## Advice\nUse **evidence**.\n```js\nconst score = 90;\n```\n<script>alert("x")</script>'} />);
    expect(screen.getByRole("heading", { name: "Advice" })).toBeInTheDocument();
    expect(screen.getByText("evidence").tagName).toBe("STRONG");
    expect(container.querySelector("pre code")?.textContent).toContain("const score = 90;");
    expect(container.querySelector("script")).toBeNull();
  });
});
