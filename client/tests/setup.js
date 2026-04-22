import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

// Ensure a clean DOM and localStorage between tests.
afterEach(() => {
  cleanup();
});

beforeEach(() => {
  localStorage.clear();
});

// jsdom lacks matchMedia and scrollTo; stub them for components that probe.
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
