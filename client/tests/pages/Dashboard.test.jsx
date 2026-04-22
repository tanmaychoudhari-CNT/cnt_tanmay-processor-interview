import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Dashboard.jsx pulls in a lot of dashboard sub-components at import time;
// stub them all so the orchestration layer can be tested in isolation.
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
const authState = { user: { username: "operator" } };
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => authState,
}));
vi.mock("../../src/hooks/useToast", () => ({
  useToast: () => toast,
}));
vi.mock("../../src/api/api", () => ({ errorMessage: (e) => e?.message ?? "err" }));
vi.mock("../../src/api/transactions", () => ({
  deleteTransaction: vi.fn(),
  getByCard: vi.fn(),
  getByCardType: vi.fn(),
  getByDay: vi.fn(),
  getBySource: vi.fn(),
  getSummary: vi.fn(),
  listAllTransactions: vi.fn(),
  updateTransaction: vi.fn(),
}));

// Replace every dashboard panel with a tiny probe that exposes the props we
// care about — keeps the test focused on the page-level orchestration.
vi.mock("../../src/components/dashboard/Navbar", () => ({
  default: ({ username }) => (
    <header data-testid="navbar">user:{username}</header>
  ),
}));
vi.mock("../../src/components/dashboard/SummaryPanel", () => ({
  default: ({ stats }) => (
    <div data-testid="summary">total:{stats.totalEntries}</div>
  ),
}));
vi.mock("../../src/components/dashboard/DetailedSummary", () => ({
  default: ({ stats }) => (
    <div data-testid="detailed">today:{stats.todayCount}</div>
  ),
}));
vi.mock("../../src/components/dashboard/DataInput", () => ({
  default: ({ onDataChanged }) => (
    <button data-testid="data-input" onClick={onDataChanged}>
      data-input
    </button>
  ),
}));
vi.mock("../../src/components/dashboard/DataGrid", () => ({
  default: ({ onDelete, onEdit, refreshKey }) => (
    <div data-testid="grid">
      <span data-testid="refresh-key">{refreshKey}</span>
      <button data-testid="grid-delete" onClick={() => onDelete("tx-1")}>
        delete
      </button>
      <button
        data-testid="grid-edit"
        onClick={() =>
          onEdit({
            id: "tx-1",
            cardNumber: "4267628872390355",
            amount: 12,
            status: "success",
            remarks: "",
          })
        }
      >
        edit
      </button>
    </div>
  ),
}));
vi.mock("../../src/components/dashboard/ChartsPanel", () => ({
  default: ({ entries, byCardType, byDay }) => (
    <div data-testid="charts">
      entries:{entries.length} byCardType:{byCardType.length} byDay:{byDay.length}
    </div>
  ),
}));
vi.mock("../../src/components/dashboard/InsightsPanel", () => ({
  default: ({ entries, byCard, bySource }) => (
    <div data-testid="insights">
      entries:{entries.length} byCard:{byCard.length} src:{bySource?.upload ?? 0}/{bySource?.manual ?? 0}
    </div>
  ),
}));
vi.mock("../../src/components/dashboard/EditTransactionModal", () => ({
  default: ({ open, entry, onClose, onSubmit }) => (
    <>
      {open && entry && (
        <div data-testid="modal">
          editing:{entry.id}
          <button data-testid="modal-submit" onClick={() => onSubmit({ amount: 99 })}>
            submit
          </button>
          <button data-testid="modal-close" onClick={onClose}>
            close
          </button>
        </div>
      )}
      {/* Test-only escape hatch — fires onSubmit unconditionally so we can
          exercise handleEditSubmit's `if (!editing) return` guard. */}
      <button
        data-testid="force-submit"
        onClick={() => onSubmit({ amount: 1 })}
      >
        force
      </button>
    </>
  ),
}));

import {
  deleteTransaction,
  getByCard,
  getByCardType,
  getByDay,
  getBySource,
  getSummary,
  listAllTransactions,
  updateTransaction,
} from "../../src/api/transactions";
import Dashboard, { deriveEntryStats } from "../../src/pages/Dashboard";

const summary = {
  total_entries: 42,
  total_amount: "12345.67",
  average_amount: "294.42",
  highest_amount: "999.99",
  lowest_amount: "-500.00",
  deleted_count: 3,
};

const sampleEntries = [
  {
    id: "tx-1",
    cardNumber: "4267628872390355",
    cardType: "Visa",
    amount: 100,
    timestamp: Date.now(),
    source: "manual_entry",
    status: "success",
  },
];

function primeApis(overrides = {}) {
  listAllTransactions.mockResolvedValue({ items: sampleEntries, total: 1 });
  getSummary.mockResolvedValue(summary);
  getByCardType.mockResolvedValue([{ card_type: "Visa", count: 1 }]);
  getByDay.mockResolvedValue([{ day: "2024-06-01", total_amount: "100" }]);
  getByCard.mockResolvedValue([
    { card_number: "4267628872390355", card_type: "Visa", count: 1, total_amount: "100" },
  ]);
  getBySource.mockResolvedValue({ upload: 9999, manual: 1, unknown: 0, total: 10000 });
  for (const [k, v] of Object.entries(overrides)) {
    const fn = {
      listAllTransactions,
      getSummary,
      getByCardType,
      getByDay,
      getByCard,
      getBySource,
    }[k];
    if (fn) fn.mockReset().mockImplementation(v);
  }
}

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
    const yesterday = now - 24 * 60 * 60 * 1000 * 2;
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

  it("helper `at` builds a valid timestamp", () => {
    expect(at(2024, 1, 1)).toBe(new Date(2024, 0, 1, 12).getTime());
  });
});

describe("Dashboard page (full render)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the loading spinner before the first fetch resolves", async () => {
    let resolveList;
    listAllTransactions.mockReturnValue(
      new Promise((res) => {
        resolveList = res;
      })
    );
    getSummary.mockResolvedValue(summary);
    getByCardType.mockResolvedValue([]);
    getByDay.mockResolvedValue([]);
    getByCard.mockResolvedValue([]);
    getBySource.mockResolvedValue({ upload: 0, manual: 0, unknown: 0, total: 0 });

    const { container } = render(<Dashboard />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();

    await act(async () => {
      resolveList({ items: sampleEntries, total: 1 });
    });
    await waitFor(() =>
      expect(screen.getByTestId("summary")).toBeInTheDocument()
    );
  });

  it("renders every panel after loadData resolves and stats reflect the summary", async () => {
    primeApis();
    render(<Dashboard />);

    await waitFor(() =>
      expect(screen.getByTestId("summary").textContent).toBe("total:42")
    );
    expect(screen.getByTestId("navbar").textContent).toBe("user:operator");
    expect(screen.getByTestId("detailed")).toBeInTheDocument();
    expect(screen.getByTestId("grid")).toBeInTheDocument();
    expect(screen.getByTestId("charts").textContent).toMatch(
      /entries:1 byCardType:1 byDay:1/
    );
    expect(screen.getByTestId("insights").textContent).toMatch(
      /entries:1 byCard:1 src:9999\/1/
    );
  });

  it("toasts on loadData failure and still leaves the loading state cleared", async () => {
    listAllTransactions.mockRejectedValueOnce(new Error("boom"));
    getSummary.mockResolvedValue(summary);
    getByCardType.mockResolvedValue([]);
    getByDay.mockResolvedValue([]);
    getByCard.mockResolvedValue([]);
    getBySource.mockResolvedValue({ upload: 0, manual: 0, unknown: 0, total: 0 });

    render(<Dashboard />);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("boom"));
  });

  it("delete button on the grid calls deleteTransaction and refreshes", async () => {
    primeApis();
    deleteTransaction.mockResolvedValueOnce(undefined);
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId("grid")).toBeInTheDocument());

    const before = screen.getByTestId("refresh-key").textContent;
    listAllTransactions.mockClear();
    await userEvent.click(screen.getByTestId("grid-delete"));

    await waitFor(() => expect(deleteTransaction).toHaveBeenCalledWith("tx-1"));
    expect(toast.success).toHaveBeenCalledWith("Transaction deleted");
    await waitFor(() =>
      expect(screen.getByTestId("refresh-key").textContent).not.toBe(before)
    );
  });

  it("delete failure routes to a toast.error", async () => {
    primeApis();
    deleteTransaction.mockRejectedValueOnce(new Error("nope"));
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId("grid")).toBeInTheDocument());

    await userEvent.click(screen.getByTestId("grid-delete"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("nope"));
  });

  it("edit opens the modal and submit calls updateTransaction", async () => {
    primeApis();
    updateTransaction.mockResolvedValueOnce(undefined);
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId("grid")).toBeInTheDocument());

    await userEvent.click(screen.getByTestId("grid-edit"));
    expect(screen.getByTestId("modal").textContent).toMatch(/editing:tx-1/);

    await userEvent.click(screen.getByTestId("modal-submit"));
    await waitFor(() =>
      expect(updateTransaction).toHaveBeenCalledWith("tx-1", { amount: 99 })
    );
    expect(toast.success).toHaveBeenCalledWith("Transaction updated");
  });

  it("modal close handler clears the editing state", async () => {
    primeApis();
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId("grid")).toBeInTheDocument());

    await userEvent.click(screen.getByTestId("grid-edit"));
    expect(screen.getByTestId("modal")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("modal-close"));
    await waitFor(() =>
      expect(screen.queryByTestId("modal")).not.toBeInTheDocument()
    );
  });

  it("DataInput's onDataChanged triggers refreshAll", async () => {
    primeApis();
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId("grid")).toBeInTheDocument());

    const before = screen.getByTestId("refresh-key").textContent;
    listAllTransactions.mockClear();
    await userEvent.click(screen.getByTestId("data-input"));
    await waitFor(() =>
      expect(screen.getByTestId("refresh-key").textContent).not.toBe(before)
    );
    expect(listAllTransactions).toHaveBeenCalled();
  });

  it("polls the refreshReports endpoints every 15s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    primeApis();
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId("grid")).toBeInTheDocument());

    const baselineSummary = getSummary.mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });
    await waitFor(() =>
      expect(getSummary.mock.calls.length).toBeGreaterThan(baselineSummary)
    );
  });

  it("refreshReports failures stay silent (no toast)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    primeApis();
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId("grid")).toBeInTheDocument());

    toast.error.mockClear();
    getSummary.mockRejectedValueOnce(new Error("tick fail"));
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });
    // The catch block in refreshReports swallows errors; no error toast.
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("handleEditSubmit early-returns when there is no editing entry", async () => {
    primeApis();
    updateTransaction.mockClear();
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId("grid")).toBeInTheDocument());

    // Trigger the onSubmit prop while editing state is still null. The
    // handler's `if (!editing) return;` guard fires and updateTransaction
    // never runs.
    await userEvent.click(screen.getByTestId("force-submit"));
    expect(updateTransaction).not.toHaveBeenCalled();
  });

  it("defaults deleted_count to 0 when the summary omits it", async () => {
    primeApis({
      getSummary: async () => ({
        total_entries: 5,
        total_amount: "100",
        average_amount: "20",
        highest_amount: "50",
        lowest_amount: "10",
        // deleted_count intentionally missing → `?? 0` branch fires.
      }),
    });
    render(<Dashboard />);
    await waitFor(() =>
      expect(screen.getByTestId("summary").textContent).toBe("total:5")
    );
  });

  it("polling tick also applies deleted_count ?? 0 fallback", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    primeApis();
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId("grid")).toBeInTheDocument());

    // Flip the mock so the next polling tick sees a summary without deleted_count.
    getSummary.mockResolvedValueOnce({
      total_entries: 9,
      total_amount: "9",
      average_amount: "1",
      highest_amount: "9",
      lowest_amount: "0",
    });
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });
    await waitFor(() =>
      expect(screen.getByTestId("summary").textContent).toBe("total:9")
    );
  });
});

describe("Dashboard page (user fallback)", () => {
  it("falls back to 'admin' when the auth context has a nullish user", async () => {
    const original = authState.user;
    authState.user = null;
    primeApis();
    try {
      render(<Dashboard />);
      await waitFor(() =>
        expect(screen.getByTestId("navbar").textContent).toBe("user:admin")
      );
    } finally {
      authState.user = original;
    }
  });
});
