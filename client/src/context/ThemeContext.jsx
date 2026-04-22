import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// Single source of truth for theme. Persists to localStorage so the choice
// survives reloads; an inline script in main.jsx applies the class *before*
// React renders to eliminate any light→dark flash on boot.
const ThemeContext = createContext(null);
const STORAGE_KEY = "cp.theme";

function readInitial() {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* ignore storage failures (private mode, etc.) */
  }
  if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

// Imperative DOM update — called synchronously on every toggle so the UI
// flips instantly regardless of React's effect timing. The useEffect below
// re-applies on render to keep things in sync after hot reloads.
function applyTheme(next) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (next === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  // Lets native UI (scrollbars, date pickers, form controls) match.
  root.style.colorScheme = next;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readInitial);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* noop */
    }
  }, [theme]);

  const setTheme = useCallback((next) => {
    applyTheme(next);
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  }, []);

  const value = { theme, isDark: theme === "dark", toggle, setTheme };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
