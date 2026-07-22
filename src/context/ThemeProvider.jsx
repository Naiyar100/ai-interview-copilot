import { useEffect, useMemo, useState } from "react";
import ThemeContext from "./ThemeContext";

const THEME_KEY = "interview-theme";
const getSystemTheme = () => window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(() => localStorage.getItem(THEME_KEY) || "system");
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);
  const theme = preference === "system" ? systemTheme : preference;

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemTheme(media.matches ? "dark" : "light");
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.classList.toggle("theme-dark", theme === "dark");
    localStorage.setItem(THEME_KEY, preference);
  }, [preference, theme]);

  const value = useMemo(() => ({ theme, preference, setPreference }), [preference, theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export default ThemeProvider;
