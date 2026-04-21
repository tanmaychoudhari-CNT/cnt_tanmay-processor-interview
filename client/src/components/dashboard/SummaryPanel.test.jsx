import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SummaryPanel from "./SummaryPanel";

const stats = {
  totalEntries: 1234,
  totalAmount: 9876.5,
  averageAmount: 8.12,
  highestAmount: 500,
};

describe("SummaryPanel", () => {
  it("renders all four stat cards with formatted values", () => {
    render(<SummaryPanel stats={stats} />);

    expect(screen.getByText("Total Entries")).toBeInTheDocument();
    expect(screen.getByText("1,234")).toBeInTheDocument();

    expect(screen.getByText("Total Amount")).toBeInTheDocument();
    expect(screen.getByText("$9,876.50")).toBeInTheDocument();

    expect(screen.getByText("Average Value")).toBeInTheDocument();
    expect(screen.getByText("$8.12")).toBeInTheDocument();

    expect(screen.getByText("Highest Txn")).toBeInTheDocument();
    expect(screen.getByText("$500.00")).toBeInTheDocument();
  });

  it("renders 0 defaults when fields are missing", () => {
    render(<SummaryPanel stats={{}} />);
    // highestAmount missing → "$0.00"
    expect(screen.getByText("Highest Txn")).toBeInTheDocument();
    const zeros = screen.getAllByText("$0.00");
    expect(zeros.length).toBeGreaterThan(0);
  });
});
