import { createContext, useContext } from "react";

const ThemeContext = createContext(null);

export const useTheme = () => {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
};

export default ThemeContext;
