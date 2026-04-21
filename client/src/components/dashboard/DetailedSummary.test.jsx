import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// AnimatePresence / motion need browser layout APIs; flatten them for jsdom.
vi.mock("motion/react", () => {
  const strip = ({
    initial, animate, exit, transition, layout, layoutId,
    whileHover, whileTap, whileInView, whileDrag, whileFocus,
    variants, ...rest
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

import DetailedSummary from "./DetailedSummary";

const stats = {
  totalEntries: 42,
  totalAmount: 1234.56,
  averageAmount: 29.39,
  highestAmount: 500,
  lowestAmount: -10,
  uniqueCards: 7,
  topBrand: "Visa",
  todayCount: 3,
};

describe("DetailedSummary", () => {
  it("renders every labeled row", () => {
    render(<DetailedSummary stats={stats} />);
    for (const label of [
      "Total entries",
      "Total amount",
      "Average amount",
      "Highest",
      "Lowest",
      "Unique cards",
      "Top brand",
      "Today",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("formats currency fields and shows the top brand verbatim", () => {
    render(<DetailedSummary stats={stats} />);
    expect(screen.getByText("$1,234.56")).toBeInTheDocument();
    expect(screen.getByText("$500.00")).toBeInTheDocument();
    expect(screen.getByText("Visa")).toBeInTheDocument();
  });

  it("defaults missing fields without crashing", () => {
    render(<DetailedSummary stats={{}} />);
    expect(screen.getByText("Unique cards")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
