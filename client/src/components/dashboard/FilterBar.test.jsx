import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FilterBar from "./FilterBar";

const DEFAULTS = {
  search: "",
  cardType: "",
  dateFrom: "",
  dateTo: "",
  amountMin: "",
  amountMax: "",
};

describe("FilterBar", () => {
  it("renders all filter chips", () => {
    render(<FilterBar filters={DEFAULTS} onChange={() => {}} onClear={() => {}} isDirty={false} />);
    expect(screen.getByPlaceholderText(/search card number/i)).toBeInTheDocument();
    // The uppercase chip labels are the reliable anchors.
    expect(screen.getByText("Card")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByLabelText(/minimum amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/maximum amount/i)).toBeInTheDocument();
  });

  it("card dropdown shows exactly the 4 brands + All", () => {
    render(<FilterBar filters={DEFAULTS} onChange={() => {}} onClear={() => {}} isDirty={false} />);
    const select = screen.getByRole("combobox");
    const opts = Array.from(select.querySelectorAll("option")).map((o) => o.textContent);
    expect(opts).toEqual(["All cards", "Visa", "MasterCard", "Amex", "Discover"]);
  });

  it("calls onChange when the card type changes", async () => {
    const onChange = vi.fn();
    render(<FilterBar filters={DEFAULTS} onChange={onChange} onClear={() => {}} isDirty={false} />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "Visa");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ cardType: "Visa" }));
  });

  it("typing in the search input calls onChange with updated search", async () => {
    const onChange = vi.fn();
    render(<FilterBar filters={DEFAULTS} onChange={onChange} onClear={() => {}} isDirty={false} />);
    const input = screen.getByPlaceholderText(/search card number/i);
    await userEvent.type(input, "4");
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: "4" })
    );
  });

  it("calls onChange for amount min/max fields", async () => {
    const onChange = vi.fn();
    render(<FilterBar filters={DEFAULTS} onChange={onChange} onClear={() => {}} isDirty={false} />);
    await userEvent.type(screen.getByLabelText(/minimum amount/i), "5");
    await userEvent.type(screen.getByLabelText(/maximum amount/i), "9");
    const calls = onChange.mock.calls.map((c) => c[0]);
    expect(calls.some((c) => c.amountMin === "5")).toBe(true);
    expect(calls.some((c) => c.amountMax === "9")).toBe(true);
  });

  it("Clear filters button is only shown when isDirty", async () => {
    const onClear = vi.fn();
    const { rerender } = render(
      <FilterBar filters={DEFAULTS} onChange={() => {}} onClear={onClear} isDirty={false} />
    );
    expect(screen.queryByText(/clear filters/i)).not.toBeInTheDocument();

    rerender(
      <FilterBar filters={DEFAULTS} onChange={() => {}} onClear={onClear} isDirty={true} />
    );
    const btn = screen.getByText(/clear filters/i);
    await userEvent.click(btn);
    expect(onClear).toHaveBeenCalled();
  });
});
