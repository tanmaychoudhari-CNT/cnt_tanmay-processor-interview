import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import "./styles/index.css";

// Apply the persisted theme before React paints so there's no flash of the
// wrong palette on first load. Also set colorScheme so scrollbars / native
// form controls match immediately.
(() => {
  try {
    const stored = localStorage.getItem("cp.theme");
    const dark =
      stored === "dark" ||
      (!stored &&
        window.matchMedia?.("(prefers-color-scheme: dark)").matches);
    const root = document.documentElement;
    if (dark) root.classList.add("dark");
    root.style.colorScheme = dark ? "dark" : "light";
  } catch {
    /* ignore */
  }
})();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
