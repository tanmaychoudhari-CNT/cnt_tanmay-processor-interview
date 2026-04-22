import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTheme = vi.fn();
vi.mock("../../../src/context/ThemeContext", () => ({
  useTheme: () => mockTheme(),
}));

import ThemeToggle from "../../../src/components/dashboard/ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    mockTheme.mockReset();
  });

  it("renders 'switch to dark mode' aria-label when in light mode", () => {
    mockTheme.mockReturnValue({ isDark: false, toggle: vi.fn() });
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: /switch to dark mode/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).toHaveAttribute("title", "Switch to dark mode");
  });

  it("renders 'switch to light mode' aria-label when in dark mode", () => {
    mockTheme.mockReturnValue({ isDark: true, toggle: vi.fn() });
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: /switch to light mode/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("invokes toggle() when clicked", async () => {
    const toggle = vi.fn();
    mockTheme.mockReturnValue({ isDark: false, toggle });
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button"));
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it("uses the dark-mode pill background class when isDark", () => {
    mockTheme.mockReturnValue({ isDark: true, toggle: vi.fn() });
    render(<ThemeToggle />);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/bg-gray-950/);
  });

  it("uses the light-mode pill background class when not isDark", () => {
    mockTheme.mockReturnValue({ isDark: false, toggle: vi.fn() });
    render(<ThemeToggle />);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/bg-gray-100/);
  });

  it("renders both the Day Mode and Night Mode labels (cross-faded)", () => {
    mockTheme.mockReturnValue({ isDark: false, toggle: vi.fn() });
    const { container } = render(<ThemeToggle />);
    expect(container.textContent).toMatch(/day\s*mode/i);
    expect(container.textContent).toMatch(/night\s*mode/i);
  });
});
