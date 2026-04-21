import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// recharts' ResponsiveContainer measures DOM size; jsdom reports 0 and
// recharts warns. Stub it with a plain div so the charts render to something
// we can assert on.
vi.mock("recharts", async () => {
  const actual = await vi.importActual("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }) => (
      <div style={{ width: 600, height: 400 }}>{children}</div>
    ),
  };
});

import ChartsPanel from "./ChartsPanel";

const entry = (amount, timestamp) => ({
  id: `tx-${amount}`,
  cardNumber: "4267628872390355",
  cardType: "Visa",
  amount,
  timestamp,
  status: "success",
  source: "manual_entry",
});

describe("ChartsPanel", () => {
  it("renders the trend + distribution panels and their headings", () => {
    render(
      <ChartsPanel
        entries={[
          entry(100, new Date(2024, 5, 1).getTime()),
          entry(750, new Date(2024, 5, 2).getTime()),
          entry(2500, new Date(2024, 5, 3).getTime()),
        ]}
      />
    );
    expect(screen.getByText(/financial trends/i)).toBeInTheDocument();
    expect(screen.getByText(/distribution/i)).toBeInTheDocument();
    expect(screen.getByText(/amount segmentation/i)).toBeInTheDocument();
  });

  it("renders without crashing when there are no entries", () => {
    render(<ChartsPanel entries={[]} />);
    expect(screen.getByText(/financial trends/i)).toBeInTheDocument();
  });
});
