"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolved: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "theme";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const t = localStorage.getItem(STORAGE_KEY);
  if (t === "light" || t === "dark" || t === "system") return t;
  return "system";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  let dark = false;
  if (theme === "dark") dark = true;
  else if (theme === "light") dark = false;
  else dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (dark) {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
  }
  return dark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
    const r = applyTheme(next);
    setResolved(r);
  }, []);

  useEffect(() => {
    const stored = getStoredTheme();
    setThemeState(stored);
    setResolved(applyTheme(stored));
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setResolved(applyTheme("system"));
    m.addEventListener("change", handler);
    return () => m.removeEventListener("change", handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved }}>
      {children}
    </ThemeContext.Provider>
  );
}

const defaultThemeValue: ThemeContextValue = {
  theme: "system",
  setTheme: () => {},
  resolved: typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
};

export function useTheme() {
  const ctx = useContext(ThemeContext);
  return ctx ?? defaultThemeValue;
}
