/**
 * DataGrid is the highest-level UI piece. We verify:
 *   1. It calls listTransactions on mount with the default params
 *   2. The rows returned by the API are rendered in the table body
 *   3. Changing the search input triggers a new fetch (after debounce)
 *   4. Clicking a sort header flips the sort_by on the next fetch
 *   5. Edit / delete buttons hand the entry back via the props
 */
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// motion's `AnimatePresence mode="popLayout"` relies on browser APIs jsdom
// doesn't provide — stub motion so the tree renders as plain HTML.
vi.mock("motion/react", () => {
  const strip = ({
    initial, animate, exit, transition, layout, layoutId,
    whileHover, whileTap, whileInView, whileDrag, whileFocus,
    variants, drag, dragConstraints, onAnimationStart,
    onAnimationComplete, ...rest
  }) => rest;
  const motion = new Proxy(
    {},
    {
      get: (_t, tag) =>
        React.forwardRef((props, ref) =>
          React.createElement(tag, { ...strip(props), ref })
        ),
    }
  );
  return {
    motion,
    AnimatePresence: ({ children }) =>
      React.createElement(React.Fragment, null, children),
  };
});

// react-day-picker pulls in CSS and needs browser layout APIs — stub it.
vi.mock("../../../src/components/dashboard/DateRangePicker", () => ({
  default: () =>
    React.createElement("div", { "data-testid": "date-picker-stub" }),
}));

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock("../../../src/hooks/useToast", () => ({
  useToast: () => toast,
}));

vi.mock("../../../src/api/transactions", () => ({
  listTransactions: vi.fn(),
}));

vi.mock("../../../src/api/api", () => ({
  errorMessage: (e) => e?.message ?? "err",
}));

import { listTransactions } from "../../../src/api/transactions";
import DataGrid from "../../../src/components/dashboard/DataGrid";

const row = (overrides = {}) => ({
  id: "tx-1",
  cardNumber: "4267628872390354",
  cardType: "Visa",
  amount: 100,
  timestamp: Date.UTC(2024, 5, 1, 10, 0),
  status: "success",
  source: "manual_entry",
  fileName: null,
  remarks: null,
  isDeleted: false,
  ...overrides,
});

function mockResponse(items, total = items.length) {
  listTransactions.mockResolvedValueOnce({
    items,
    total,
    page: 1,
    page_size: 8,
  });
}

/** Returns the <tbody> so tests can query the row region directly. */
function getTableBody() {
  return screen.getByRole("table").querySelector("tbody");
}

describe("DataGrid", () => {
  beforeEach(() => {
    listTransactions.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
    toast.info.mockReset();
  });

  it("fetches on mount with default params and renders rows", async () => {
    mockResponse([row()]);
    render(<DataGrid onDelete={() => {}} onEdit={() => {}} refreshKey={0} />);

    await waitFor(() => expect(listTransactions).toHaveBeenCalled());
    const params = listTransactions.mock.calls[0][0];
    expect(params.page).toBe(1);
    expect(params.sort_by).toBe("transaction_date");
    expect(params.sort_dir).toBe("desc");

    await waitFor(() => {
      expect(
        within(getTableBody()).getByText("42**********0354")
      ).toBeInTheDocument();
    });
    // Type + amount appear inside the row only.
    expect(within(getTableBody()).getByText("Visa")).toBeInTheDocument();
    expect(within(getTableBody()).getByText("$100.00")).toBeInTheDocument();
  });

  it("re-fetches after the search input (debounced)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockResponse([row()]); // initial mount
      mockResponse([]);      // after debounce

      render(<DataGrid onDelete={() => {}} onEdit={() => {}} refreshKey={0} />);
      await waitFor(() => expect(listTransactions).toHaveBeenCalledTimes(1));

      const input = screen.getByPlaceholderText(/search card number/i);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.type(input, "4267");

      // Still 1 call — debounce is 300 ms.
      expect(listTransactions).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(400);

      await waitFor(() =>
        expect(listTransactions).toHaveBeenCalledTimes(2)
      );
      expect(listTransactions.mock.calls[1][0].search).toBe("4267");
    } finally {
      vi.useRealTimers();
    }
  });

  it("sort header flips sort_by on re-fetch", async () => {
    mockResponse([row()]);
    render(<DataGrid onDelete={() => {}} onEdit={() => {}} refreshKey={0} />);
    await waitFor(() => expect(listTransactions).toHaveBeenCalledTimes(1));

    mockResponse([row()]);
    // Scope the click to the column header so we don't hit the new "Amount"
    // filter-chip label in the toolbar.
    await userEvent.click(
      within(screen.getByRole("table").querySelector("thead")).getByText(
        "Amount"
      )
    );

    await waitFor(() => expect(listTransactions).toHaveBeenCalledTimes(2));
    const p = listTransactions.mock.calls[1][0];
    expect(p.sort_by).toBe("amount");
  });

  it("edit button calls onEdit with the entry", async () => {
    mockResponse([row()]);
    const onEdit = vi.fn();
    render(<DataGrid onDelete={() => {}} onEdit={onEdit} refreshKey={0} />);

    await waitFor(() =>
      expect(
        within(getTableBody()).getByText("42**********0354")
      ).toBeInTheDocument()
    );

    await userEvent.click(screen.getByLabelText("edit"));
    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: "tx-1" })
    );
  });

  it("delete button calls onDelete with the entry id", async () => {
    mockResponse([row()]);
    const onDelete = vi.fn();
    render(<DataGrid onDelete={onDelete} onEdit={() => {}} refreshKey={0} />);

    await waitFor(() =>
      expect(
        within(getTableBody()).getByText("42**********0354")
      ).toBeInTheDocument()
    );

    await userEvent.click(screen.getByLabelText("delete"));
    expect(onDelete).toHaveBeenCalledWith("tx-1");
  });

  it("toggling the same sort header repeatedly flips desc → asc → desc", async () => {
    mockResponse([row()]);
    render(<DataGrid onDelete={() => {}} onEdit={() => {}} refreshKey={0} />);
    await waitFor(() => expect(listTransactions).toHaveBeenCalledTimes(1));

    mockResponse([row()]);
    await userEvent.click(
      within(screen.getByRole("table").querySelector("thead")).getByText("Amount")
    );
    await waitFor(() => expect(listTransactions).toHaveBeenCalledTimes(2));
    expect(listTransactions.mock.calls[1][0].sort_dir).toBe("desc");

    mockResponse([row()]);
    await userEvent.click(
      within(screen.getByRole("table").querySelector("thead")).getByText("Amount")
    );
    await waitFor(() => expect(listTransactions).toHaveBeenCalledTimes(3));
    expect(listTransactions.mock.calls[2][0].sort_dir).toBe("asc");

    // One more toggle on the same column → asc → desc, exercising the other
    // arm of the inner ternary in the sort-direction reducer.
    mockResponse([row()]);
    await userEvent.click(
      within(screen.getByRole("table").querySelector("thead")).getByText("Amount")
    );
    await waitFor(() => expect(listTransactions).toHaveBeenCalledTimes(4));
    expect(listTransactions.mock.calls[3][0].sort_dir).toBe("desc");
  });

  it("toasts an error when listTransactions rejects", async () => {
    listTransactions.mockRejectedValueOnce(new Error("backend boom"));
    render(<DataGrid onDelete={() => {}} onEdit={() => {}} refreshKey={0} />);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("backend boom"));
  });

  it("renders the empty state with a Clear filters affordance when filters are dirty", async () => {
    listTransactions.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 8 });
    render(<DataGrid onDelete={() => {}} onEdit={() => {}} refreshKey={0} />);
    await waitFor(() => expect(listTransactions).toHaveBeenCalled());

    // Type into the card-search box to make the grid "dirty".
    fireEvent.change(screen.getByPlaceholderText(/search card number/i), {
      target: { value: "9999" },
    });
    await waitFor(() =>
      expect(within(getTableBody()).getByText(/no records match your filters/i)).toBeInTheDocument()
    );
    // Both the FilterBar toolbar and the empty-state row offer "Clear filters" —
    // the empty-state one lives inside the tbody.
    expect(within(getTableBody()).getByText(/clear filters/i)).toBeInTheDocument();
  });

  it("renders rows that have remarks, file uploads, unknown card types, and missing timestamps", async () => {
    listTransactions.mockResolvedValueOnce({
      items: [
        row({
          id: "tx-2",
          cardType: null,
          status: "weird-status",
          source: "file_upload",
          fileName: "import-2024.csv",
          remarks: "first chargeback",
          timestamp: null,
        }),
      ],
      total: 1,
      page: 1,
      page_size: 8,
    });
    render(<DataGrid onDelete={() => {}} onEdit={() => {}} refreshKey={0} />);
    await waitFor(() =>
      expect(
        within(getTableBody()).getByText("42**********0354")
      ).toBeInTheDocument()
    );
    expect(within(getTableBody()).getByText("first chargeback")).toBeInTheDocument();
    expect(within(getTableBody()).getByText("import-2024.csv")).toBeInTheDocument();
    // Both the missing card-type and the missing timestamp render as "—".
    expect(within(getTableBody()).getAllByText("—").length).toBeGreaterThanOrEqual(2);
    // file_upload renders the Batch label in the source badge.
    expect(within(getTableBody()).getByText("Batch")).toBeInTheDocument();
    // Unknown status still shows up as text (capitalised by CSS).
    expect(within(getTableBody()).getByText(/weird-status/)).toBeInTheDocument();
  });

  it("renders 'failed', 'pending', and missing-status badges with their distinct colour rules", async () => {
    listTransactions.mockResolvedValueOnce({
      items: [
        row({ id: "tx-failed", status: "failed" }),
        row({ id: "tx-pending", status: "pending" }),
        // status=null exercises the `{status || "—"}` fallback in the badge.
        row({ id: "tx-no-status", status: null, cardType: "Visa" }),
      ],
      total: 3,
      page: 1,
      page_size: 8,
    });
    render(<DataGrid onDelete={() => {}} onEdit={() => {}} refreshKey={0} />);
    await waitFor(() =>
      expect(within(getTableBody()).getByText(/failed/i)).toBeInTheDocument()
    );
    expect(within(getTableBody()).getByText(/pending/i)).toBeInTheDocument();
    // Missing status renders "—" inside the status badge (the dot also falls
    // through to bg-gray-400).
    const dashes = within(getTableBody()).getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("renders negative amounts with the red text class", async () => {
    listTransactions.mockResolvedValueOnce({
      items: [row({ id: "tx-neg", amount: -250 })],
      total: 1,
      page: 1,
      page_size: 8,
    });
    render(<DataGrid onDelete={() => {}} onEdit={() => {}} refreshKey={0} />);
    await waitFor(() =>
      expect(
        within(getTableBody()).getByText("-$250.00")
      ).toBeInTheDocument()
    );
    const amountCell = within(getTableBody()).getByText("-$250.00");
    expect(amountCell.className).toMatch(/text-rose-500/);
  });

  it("paginates: 'next' increments page on the next fetch", async () => {
    listTransactions.mockResolvedValueOnce({
      items: [row()],
      total: 24,
      page: 1,
      page_size: 8,
    });
    render(<DataGrid onDelete={() => {}} onEdit={() => {}} refreshKey={0} />);
    await waitFor(() => expect(listTransactions).toHaveBeenCalledTimes(1));

    mockResponse([row()], 24);
    await userEvent.click(screen.getByLabelText(/next page/i));
    await waitFor(() => expect(listTransactions).toHaveBeenCalledTimes(2));
    expect(listTransactions.mock.calls[1][0].page).toBe(2);

    mockResponse([row()], 24);
    await userEvent.click(screen.getByLabelText(/previous page/i));
    await waitFor(() => expect(listTransactions).toHaveBeenCalledTimes(3));
    expect(listTransactions.mock.calls[2][0].page).toBe(1);
  });
});
