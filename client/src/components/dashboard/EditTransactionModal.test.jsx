import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

import EditTransactionModal from "./EditTransactionModal";

const entry = {
  id: "tx-1",
  cardNumber: "4267628872390355",
  amount: 100,
  status: "success",
  remarks: "first",
};

describe("EditTransactionModal", () => {
  it("renders nothing when closed", () => {
    render(
      <EditTransactionModal
        open={false}
        entry={entry}
        onClose={() => {}}
        onSubmit={() => {}}
      />
    );
    expect(screen.queryByText(/edit transaction/i)).not.toBeInTheDocument();
  });

  it("prefills the form from the entry prop", () => {
    render(
      <EditTransactionModal
        open
        entry={entry}
        onClose={() => {}}
        onSubmit={() => {}}
      />
    );
    expect(screen.getByText(entry.cardNumber)).toBeInTheDocument();
    expect(screen.getByDisplayValue("100")).toBeInTheDocument();
    expect(screen.getByDisplayValue("first")).toBeInTheDocument();
  });

  it("calls onSubmit with the edited values and then onClose", async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue();

    render(
      <EditTransactionModal
        open
        entry={entry}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    // Controlled numeric input — set the whole value in one shot.
    fireEvent.change(screen.getByDisplayValue("100"), {
      target: { value: "250.75" },
    });

    // Switch to the "Pending" status pill.
    await userEvent.click(screen.getByText("Pending"));

    await userEvent.click(screen.getByText(/save changes/i));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 250.75, status: "pending" })
      )
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("shows an error when onSubmit rejects and does NOT auto-close", async () => {
    const onClose = vi.fn();
    const onSubmit = vi
      .fn()
      .mockRejectedValue({ response: { data: { detail: "nope" } } });

    render(
      <EditTransactionModal
        open
        entry={entry}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );
    await userEvent.click(screen.getByText(/save changes/i));
    await waitFor(() =>
      expect(screen.getByText("nope")).toBeInTheDocument()
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
