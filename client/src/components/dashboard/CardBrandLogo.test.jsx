import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CardBrandLogo from "./CardBrandLogo";

describe("CardBrandLogo", () => {
  it("renders a Visa mark with the VISA text", () => {
    render(<CardBrandLogo type="Visa" />);
    expect(screen.getByLabelText("Visa")).toBeInTheDocument();
    expect(screen.getByText("VISA")).toBeInTheDocument();
  });

  it("renders an Amex mark", () => {
    render(<CardBrandLogo type="Amex" />);
    expect(screen.getByLabelText("American Express")).toBeInTheDocument();
    expect(screen.getByText("AMEX")).toBeInTheDocument();
  });

  it("renders a MasterCard mark (two overlapping circles)", () => {
    const { container } = render(<CardBrandLogo type="MasterCard" />);
    expect(screen.getByLabelText("MasterCard")).toBeInTheDocument();
    expect(container.querySelectorAll("span > span").length).toBeGreaterThanOrEqual(2);
  });

  it("renders a Discover mark", () => {
    render(<CardBrandLogo type="Discover" />);
    expect(screen.getByLabelText("Discover")).toBeInTheDocument();
    expect(screen.getByText("DISCOVER")).toBeInTheDocument();
  });

  it("falls back to the Unknown mark for unrecognized types", () => {
    render(<CardBrandLogo type="Foo" />);
    expect(screen.getByLabelText("Unknown card")).toBeInTheDocument();
  });

  it("defaults to Unknown when no type is passed", () => {
    render(<CardBrandLogo />);
    expect(screen.getByLabelText("Unknown card")).toBeInTheDocument();
  });
});
