import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

// react-day-picker renders a full <table> calendar that needs browser layout
// APIs. Swap it for a stub so we can focus on the wrapper's behavior.
vi.mock("react-day-picker", () => ({
  DayPicker: ({ selected }) => (
    <div data-testid="dp">
      {selected?.from ? "from-set" : "from-empty"}
    </div>
  ),
}));

import DateRangePicker from "./DateRangePicker";

describe("DateRangePicker", () => {
  it("shows the default 'Date range' label when nothing is selected", () => {
    render(<DateRangePicker from="" to="" onChange={() => {}} />);
    expect(screen.getByText("Date range")).toBeInTheDocument();
  });

  it("renders the selected range in the trigger label", () => {
    render(
      <DateRangePicker from="2024-06-01" to="2024-06-15" onChange={() => {}} />
    );
    expect(screen.getByText(/Jun 1, 2024.*Jun 15, 2024/)).toBeInTheDocument();
  });

  it("opens the popover on click and shows Apply / Cancel", async () => {
    render(<DateRangePicker from="" to="" onChange={() => {}} />);
    await userEvent.click(screen.getByText("Date range"));
    expect(screen.getByText("Apply")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("clear-range button wipes both dates via onChange", async () => {
    const onChange = vi.fn();
    render(
      <DateRangePicker
        from="2024-06-01"
        to="2024-06-15"
        onChange={onChange}
      />
    );
    await userEvent.click(screen.getByLabelText(/clear date range/i));
    expect(onChange).toHaveBeenCalledWith({ dateFrom: "", dateTo: "" });
  });

  it("Cancel closes the popover without firing onChange", async () => {
    const onChange = vi.fn();
    render(<DateRangePicker from="" to="" onChange={onChange} />);
    await userEvent.click(screen.getByText("Date range"));
    await userEvent.click(screen.getByText("Cancel"));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByText("Apply")).not.toBeInTheDocument();
  });
});
