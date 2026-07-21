import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ThemeProvider from "../context/ThemeProvider";
import { useTheme } from "../context/ThemeContext";

function ThemeHarness() {
  const { preference, theme, setPreference } = useTheme();
  return <><span>{preference}:{theme}</span><button type="button" onClick={() => setPreference("dark")}>Use dark</button></>;
}

describe("theme system", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });

  test("persists a preference and updates the document before shared UI renders", async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><ThemeHarness /></ThemeProvider>);
    expect(screen.getByText("system:light")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Use dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("interview-theme")).toBe("dark");
  });
});
