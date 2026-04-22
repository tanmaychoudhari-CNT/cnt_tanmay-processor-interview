import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("motion/react", () => {
  const strip = ({
    initial, animate, exit, transition, layout, layoutId,
    whileHover, whileTap, whileInView, variants, ...rest
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

import InsightsPanel from "../../../src/components/dashboard/InsightsPanel";

const entry = (over = {}) => ({
  id: `id-${Math.random()}`,
  cardNumber: "4267628872390355",
  cardType: "Visa",
  amount: 100,
  timestamp: Date.UTC(2024, 5, 1),
  source: "manual_entry",
  status: "success",
  ...over,
});

describe("InsightsPanel", () => {
  it("shows empty states when there is nothing to summarize", () => {
    render(<InsightsPanel entries={[]} />);
    expect(screen.getByText(/no transactions yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no source data yet/i)).toBeInTheDocument();
  });

  it("ranks cards by absolute total spend", () => {
    render(
      <InsightsPanel
        entries={[
          entry({ cardNumber: "4111111111111111", amount: 10 }),
          entry({ cardNumber: "4111111111111111", amount: 20 }),
          entry({ cardNumber: "5555555555554444", cardType: "MasterCard", amount: 500 }),
        ]}
      />
    );
    // Top card is the $500 MasterCard.
    const first = screen.getAllByText(/\$\d/)[0];
    expect(first.textContent).toMatch(/\$500\.00/);
  });

  it("uses the server-side byCard aggregate when provided (top 5)", () => {
    render(
      <InsightsPanel
        entries={[]}
        byCard={[
          { card_number: "4111111111111111", card_type: "Visa", count: 5, total_amount: "1234.50" },
          { card_number: "5555555555554444", card_type: "MasterCard", count: 2, total_amount: "-50" },
        ]}
      />
    );
    expect(screen.getByText("Top cards by volume")).toBeInTheDocument();
    expect(screen.getByText(/\$1,234\.50/)).toBeInTheDocument();
    // total_amount is normalized via Math.abs, so the negative card shows |50|.
    expect(screen.getByText(/\$50\.00/)).toBeInTheDocument();
  });

  it("byCard with null total_amount falls back to 0 instead of NaN", () => {
    render(
      <InsightsPanel
        entries={[]}
        byCard={[
          { card_number: "4111111111111111", card_type: "Visa", count: 1, total_amount: null },
        ]}
      />
    );
    expect(screen.getByText("$0.00")).toBeInTheDocument();
  });

  it("computes the upload vs manual source split", () => {
    render(
      <InsightsPanel
        entries={[
          entry({ source: "file_upload" }),
          entry({ source: "file_upload" }),
          entry({ source: "file_upload" }),
          entry({ source: "manual_entry" }),
        ]}
      />
    );
    expect(screen.getByText("Batch")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
    // 3 uploads, 1 manual → 75% / 25%.
    expect(screen.getByText(/75%/)).toBeInTheDocument();
    expect(screen.getByText(/25%/)).toBeInTheDocument();
  });
});
