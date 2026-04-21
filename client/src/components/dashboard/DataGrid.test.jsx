/**
 * DataGrid is the highest-level UI piece. We verify:
 *   1. It calls listTransactions on mount with the default params
 *   2. The rows returned by the API are rendered in the table body
 *   3. Changing the search input triggers a new fetch (after debounce)
 *   4. Clicking a sort header flips the sort_by on the next fetch
 *   5. Edit / delete buttons hand the entry back via the props
 */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
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
vi.mock("./DateRangePicker", () => ({
  default: () =>
    React.createElement("div", { "data-testid": "date-picker-stub" }),
}));

vi.mock("../../hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock("../../services/transactions", () => ({
  listTransactions: vi.fn(),
}));

vi.mock("../../services/api", () => ({
  errorMessage: (e) => e?.message ?? "err",
}));

import { listTransactions } from "../../services/transactions";
import DataGrid from "./DataGrid";

const row = (overrides = {}) => ({
  id: "tx-1",
  cardNumber: "4267628872390355",
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
        within(getTableBody()).getByText("42**********0355")
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
        within(getTableBody()).getByText("42**********0355")
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
        within(getTableBody()).getByText("42**********0355")
      ).toBeInTheDocument()
    );

    await userEvent.click(screen.getByLabelText("delete"));
    expect(onDelete).toHaveBeenCalledWith("tx-1");
  });
});
