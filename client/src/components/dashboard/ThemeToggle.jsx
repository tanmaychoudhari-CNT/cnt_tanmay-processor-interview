import React from "react";
import { Sun, MoonStar } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

// Premium day/night toggle — inspired by the reference screenshot.
//
// Layout:
//   • Full-width pill that inverts between day (light) and night (dark).
//   • A white circular knob slides between ends, carrying the sun (day) or
//     moon+stars (night) icon inside it.
//   • A bold label fills the remaining half of the pill on the opposite
//     side of the knob and cross-fades on state change.
//
// Width/height are tuned to sit cleanly in the navbar without feeling
// cramped next to the user block.
export default function ThemeToggle() {
  const { isDark, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={[
        "group relative inline-flex items-center h-9 w-[148px] rounded-full select-none overflow-hidden",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2",
        "focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-950",
        "transition-[background-color,box-shadow] duration-500 ease-out",
        // Hard inversion: white → near-black, matching the reference's crisp
        // two-state aesthetic. A subtle ring makes the pill define itself
        // on any surface.
        isDark
          ? "bg-gray-950 ring-1 ring-white/10 shadow-[inset_0_0_20px_rgba(255,255,255,0.03)]"
          : "bg-gray-100 ring-1 ring-black/5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]",
      ].join(" ")}
    >
      {/* DAY MODE label — visible in light mode, sits on the LEFT (opposite the knob). */}
      <span
        aria-hidden
        className={[
          "absolute inset-y-0 left-4 right-10 flex items-center",
          "text-[11px] font-extrabold tracking-[0.15em] uppercase",
          "transition-all duration-300",
          isDark
            ? "opacity-0 -translate-x-1 text-gray-900"
            : "opacity-100 translate-x-0 text-gray-900",
        ].join(" ")}
      >
        Day&nbsp;Mode
      </span>

      {/* NIGHT MODE label — visible in dark mode, sits on the RIGHT (opposite the knob). */}
      <span
        aria-hidden
        className={[
          "absolute inset-y-0 right-4 left-10 flex items-center justify-end",
          "text-[11px] font-extrabold tracking-[0.15em] uppercase",
          "transition-all duration-300",
          isDark
            ? "opacity-100 translate-x-0 text-white"
            : "opacity-0 translate-x-1 text-white",
        ].join(" ")}
      >
        Night&nbsp;Mode
      </span>

      {/* Sliding knob — carries the active icon and does the heavy lifting
          on the animation side with a gentle spring. */}
      <span
        className={[
          "absolute top-1 h-7 w-7 rounded-full bg-white",
          "shadow-[0_2px_10px_rgba(0,0,0,0.18)] ring-1 ring-black/10",
          "flex items-center justify-center",
          "transition-[left] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          // Slide between the two ends of the pill. Left value is
          // calc(pill-width - knob-width - padding).
          isDark ? "left-1" : "left-[calc(100%-32px)]",
        ].join(" ")}
      >
        <Sun
          className={[
            "absolute w-4 h-4 text-amber-500 transition-all duration-300",
            isDark
              ? "opacity-0 rotate-90 scale-75"
              : "opacity-100 rotate-0 scale-100",
          ].join(" ")}
          strokeWidth={2.25}
        />
        <MoonStar
          className={[
            "absolute w-4 h-4 text-gray-800 transition-all duration-300",
            isDark
              ? "opacity-100 rotate-0 scale-100"
              : "opacity-0 -rotate-90 scale-75",
          ].join(" ")}
          strokeWidth={2.25}
        />
      </span>
    </button>
  );
}
