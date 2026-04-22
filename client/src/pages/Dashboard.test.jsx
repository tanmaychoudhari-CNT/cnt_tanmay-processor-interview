import { describe, expect, it, vi } from "vitest";

// Dashboard.jsx pulls in a lot of dashboard sub-components at import time;
// we only care about the pure helper here, so stub out the hooks/services
// so module evaluation succeeds without any network plumbing.
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock("../hooks/useToast", () => ({
  useToast: () => ({ success: () => {}, error: () => {}, info: () => {} }),
}));
vi.mock("../api/api", () => ({ errorMessage: (e) => e?.message }));
vi.mock("../api/transactions", () => ({
  deleteTransaction: vi.fn(),
  getSummary: vi.fn(),
  listAllTransactions: vi.fn(),
  updateTransaction: vi.fn(),
}));

import { deriveEntryStats } from "./Dashboard";

function at(year, month, day, hour = 12) {
  return new Date(year, month - 1, day, hour).getTime();
}

describe("Dashboard.deriveEntryStats", () => {
  it("returns zeros / em-dash for an empty input", () => {
    const s = deriveEntryStats([]);
    expect(s.uniqueCards).toBe(0);
    expect(s.topBrand).toBe("—");
    expect(s.todayCount).toBe(0);
  });

  it("counts distinct card numbers (duplicates collapse)", () => {
    const s = deriveEntryStats([
      { cardNumber: "4267628872390355", cardType: "Visa" },
      { cardNumber: "4267628872390355", cardType: "Visa" },
      { cardNumber: "5553959204036891", cardType: "MasterCard" },
    ]);
    expect(s.uniqueCards).toBe(2);
  });

  it("identifies the most frequent brand", () => {
    const s = deriveEntryStats([
      { cardNumber: "a", cardType: "Visa" },
      { cardNumber: "b", cardType: "Visa" },
      { cardNumber: "c", cardType: "Amex" },
    ]);
    expect(s.topBrand).toBe("Visa");
  });

  it("todayCount includes only timestamps at or after today's midnight", () => {
    const now = Date.now();
    const yesterday = now - 24 * 60 * 60 * 1000 * 2; // safely in the past
    const s = deriveEntryStats([
      { cardNumber: "a", cardType: "Visa", timestamp: now },
      { cardNumber: "b", cardType: "Visa", timestamp: now - 1000 },
      { cardNumber: "c", cardType: "Visa", timestamp: yesterday },
      { cardNumber: "d", cardType: "Visa", timestamp: null },
    ]);
    expect(s.todayCount).toBe(2);
  });

  it("ignores entries missing a brand when picking topBrand", () => {
    const s = deriveEntryStats([
      { cardNumber: "a", cardType: null },
      { cardNumber: "b", cardType: "MasterCard" },
    ]);
    expect(s.topBrand).toBe("MasterCard");
  });

  // prevent unused-import warnings from `at` even if this module pulls extra
  // cases in the future.
  it("helper `at` builds a valid timestamp", () => {
    expect(at(2024, 1, 1)).toBe(new Date(2024, 0, 1, 12).getTime());
  });
});
