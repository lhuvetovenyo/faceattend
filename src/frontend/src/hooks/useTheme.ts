import type { Theme } from "@/types";
import { useEffect, useState } from "react";

const STORAGE_KEY = "faceattend-theme";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(STORAGE_KEY) as Theme) || "professional-3d",
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Apply on mount
  useEffect(() => {
    const saved =
      (localStorage.getItem(STORAGE_KEY) as Theme) || "professional-3d";
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
  };

  return { theme, setTheme };
}

export default useTheme;
