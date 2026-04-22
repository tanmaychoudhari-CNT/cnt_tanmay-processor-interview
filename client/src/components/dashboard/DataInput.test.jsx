import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock("../../hooks/useToast", () => ({ useToast: () => toast }));

vi.mock("../../services/api", () => ({
  errorMessage: (e) => e?.message ?? "err",
}));

vi.mock("../../services/transactions", () => ({
  bulkCreateTransactions: vi.fn(),
  uploadFile: vi.fn(),
}));

import {
  bulkCreateTransactions,
  uploadFile,
} from "../../services/transactions";
import DataInput, {
  formatCardNumber,
  maxDigitsFor,
  validateAmount,
  validateCard,
  validateTimestamp,
} from "./DataInput";

describe("DataInput helpers", () => {
  it("formatCardNumber: 16 digits → 4-4-4-4", () => {
    expect(formatCardNumber("4267628872390355")).toBe("4267 6288 7239 0355");
  });

  it("formatCardNumber: 15 digits → 4-6-5 (Amex grouping)", () => {
    expect(formatCardNumber("371449635398431")).toBe("3714 496353 98431");
  });

  it("formatCardNumber: partial entries are grouped in fours", () => {
    expect(formatCardNumber("")).toBe("");
    expect(formatCardNumber("1234")).toBe("1234");
    expect(formatCardNumber("1234567")).toBe("1234 567");
  });

  it("maxDigitsFor caps at 15 for Amex and 16 for everyone else", () => {
    expect(maxDigitsFor("3")).toBe(15);
    expect(maxDigitsFor("4")).toBe(16);
    expect(maxDigitsFor("")).toBe(16);
  });

  describe("validateCard", () => {
    it("rejects empty input", () => {
      expect(validateCard("")).toMatch(/required/);
    });
    it("rejects an unsupported leading digit", () => {
      expect(validateCard("1234567890123456")).toMatch(/must start/);
    });
    it("requires Amex cards to be exactly 15 digits", () => {
      expect(validateCard("37144963539843")).toMatch(/15 digits/);
      expect(validateCard("371449635398431")).toBeNull();
    });
    it("accepts 15 or 16 digits for Visa/MC/Discover", () => {
      expect(validateCard("4267628872390355")).toBeNull();
      expect(validateCard("426762887239035")).toBeNull();
      expect(validateCard("42676288723903")).toMatch(/15 or 16/);
    });
  });

  describe("validateAmount", () => {
    it("rejects blanks and non-numeric values", () => {
      expect(validateAmount("")).toMatch(/required/);
      expect(validateAmount("abc")).toMatch(/number/);
    });
    it("rejects zero and negatives", () => {
      expect(validateAmount("0")).toMatch(/greater than/);
      expect(validateAmount("-5")).toMatch(/greater than/);
    });
    it("accepts a positive amount", () => {
      expect(validateAmount("99.95")).toBeNull();
    });
  });

  describe("validateTimestamp", () => {
    it("returns null for blank (optional field)", () => {
      expect(validateTimestamp("")).toBeNull();
    });
    it("accepts a valid datetime-local string", () => {
      expect(validateTimestamp("2024-06-01T10:00")).toBeNull();
    });
  });
});

function switchToManual(user) {
  return user.click(screen.getByText(/manual entry/i));
}

describe("DataInput — Manual Entry", () => {
  beforeEach(() => {
    toast.success.mockReset();
    toast.error.mockReset();
    bulkCreateTransactions.mockReset();
    uploadFile.mockReset();
  });

  // Character-by-character formatting is covered by the pure-helper tests
  // above. Here we verify the row-level UX: inline validation messages.
  it("shows an inline error when the card number is the wrong length", async () => {
    const user = userEvent.setup();
    render(<DataInput onDataChanged={() => {}} />);
    await switchToManual(user);

    const cardInput = screen.getByPlaceholderText(/1234 5678/);
    fireEvent.change(cardInput, { target: { value: "4111" } });
    expect(
      screen.getByText(/visa \/ mastercard \/ discover cards must be/i)
    ).toBeInTheDocument();
  });

  it("disables the submit button when rows are empty or invalid", async () => {
    const user = userEvent.setup();
    render(<DataInput onDataChanged={() => {}} />);
    await switchToManual(user);

    // With nothing entered, the Add all CTA is disabled — clicking it is a
    // no-op and no API call is fired.
    const submit = screen.getByText(/add all/i).closest("button");
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(bulkCreateTransactions).not.toHaveBeenCalled();
  });

  it("posts the batch when every row is valid", async () => {
    const user = userEvent.setup();
    bulkCreateTransactions.mockResolvedValueOnce({ accepted: 1, rejected: 0 });
    render(<DataInput onDataChanged={() => {}} />);
    await switchToManual(user);

    fireEvent.change(screen.getByPlaceholderText(/1234 5678/), {
      target: { value: "4267628872390355" },
    });
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "99.95" },
    });

    await user.click(screen.getByText(/add all/i));

    await waitFor(() =>
      expect(bulkCreateTransactions).toHaveBeenCalledTimes(1)
    );
    const payload = bulkCreateTransactions.mock.calls[0][0];
    expect(payload[0].cardNumber).toBe("4267628872390355");
    expect(payload[0].amount).toBe(99.95);
    expect(toast.success).toHaveBeenCalled();
  });

  it("allows adding and removing manual rows", async () => {
    const user = userEvent.setup();
    render(<DataInput onDataChanged={() => {}} />);
    await switchToManual(user);

    expect(screen.getAllByPlaceholderText(/1234 5678/)).toHaveLength(1);
    await user.click(screen.getByText(/add row/i));
    expect(screen.getAllByPlaceholderText(/1234 5678/)).toHaveLength(2);

    const removeButtons = screen.getAllByLabelText(/remove row/i);
    await user.click(removeButtons[0]);
    expect(screen.getAllByPlaceholderText(/1234 5678/)).toHaveLength(1);
  });
});

describe("DataInput — File Import", () => {
  beforeEach(() => {
    toast.success.mockReset();
    toast.error.mockReset();
    uploadFile.mockReset();
  });

  it("rejects files that are not CSV/JSON/XML", () => {
    render(<DataInput onDataChanged={() => {}} />);
    const input = document.querySelector('input[type="file"]');
    const bad = new File(["hi"], "notes.txt", { type: "text/plain" });
    // fireEvent.change bypasses the display:none-ish hidden input plumbing
    // that userEvent.upload struggles with.
    fireEvent.change(input, { target: { files: [bad] } });
    expect(toast.error).toHaveBeenCalled();
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it("calls uploadFile for a valid CSV and surfaces the result", async () => {
    uploadFile.mockResolvedValueOnce({
      filename: "x.csv",
      accepted: 2,
      rejected: 0,
    });
    render(<DataInput onDataChanged={() => {}} />);
    const input = document.querySelector('input[type="file"]');
    const good = new File(["a,b"], "x.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [good] } });
    await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringMatching(/x\.csv.*accepted/)
    );
  });
});
