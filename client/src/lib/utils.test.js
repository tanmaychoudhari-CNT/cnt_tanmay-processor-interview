import { describe, expect, it } from "vitest";
import { cn, formatCurrency, formatNumber, maskCard } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("resolves tailwind conflicts (tailwind-merge)", () => {
    // twMerge keeps the later class when they conflict.
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});

describe("formatCurrency", () => {
  it("formats numbers as USD", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });

  it("handles negatives", () => {
    expect(formatCurrency(-50)).toBe("-$50.00");
  });

  it("treats null/undefined as 0", () => {
    expect(formatCurrency(null)).toBe("$0.00");
    expect(formatCurrency(undefined)).toBe("$0.00");
  });

  it("accepts numeric strings", () => {
    expect(formatCurrency("99.9")).toBe("$99.90");
  });
});

describe("formatNumber", () => {
  it("adds thousands separators", () => {
    expect(formatNumber(1000000)).toBe("1,000,000");
  });

  it("handles null as 0", () => {
    expect(formatNumber(null)).toBe("0");
  });
});

describe("maskCard", () => {
  it("masks all but last 4", () => {
    expect(maskCard("4267628872390355")).toBe("•••• 0355");
  });

  it("returns short values unchanged", () => {
    expect(maskCard("123")).toBe("123");
  });

  it("handles null safely", () => {
    expect(maskCard(null)).toBe("");
  });
});
