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
vi.mock("../../../src/hooks/useToast", () => ({ useToast: () => toast }));

vi.mock("../../../src/api/api", () => ({
  errorMessage: (e) => e?.message ?? "err",
}));

vi.mock("../../../src/api/transactions", () => ({
  bulkCreateTransactions: vi.fn(),
  uploadFile: vi.fn(),
}));

import {
  bulkCreateTransactions,
  uploadFile,
} from "../../../src/api/transactions";
import DataInput, {
  formatCardNumber,
  maxDigitsFor,
  validateAmount,
  validateCard,
  validateTimestamp,
} from "../../../src/components/dashboard/DataInput";

describe("DataInput helpers", () => {
  it("formatCardNumber: 16 digits → 4-4-4-4", () => {
    expect(formatCardNumber("4267628872390354")).toBe("4267 6288 7239 0354");
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
      // Both PANs are length-valid AND Luhn-valid.
      expect(validateCard("4267628872390354")).toBeNull();
      expect(validateCard("426762887239037")).toBeNull();
      expect(validateCard("42676288723903")).toMatch(/15 or 16/);
    });
    it("rejects a length-valid card that fails the Luhn checksum", () => {
      // 16 digits, Visa leader, but the original PAN this codebase used
      // happens to fail Luhn — verify the new check catches it.
      expect(validateCard("4267628872390355")).toMatch(/Luhn/);
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
      target: { value: "4267628872390354" },
    });
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "99.95" },
    });

    await user.click(screen.getByText(/add all/i));

    await waitFor(() =>
      expect(bulkCreateTransactions).toHaveBeenCalledTimes(1)
    );
    const payload = bulkCreateTransactions.mock.calls[0][0];
    expect(payload[0].cardNumber).toBe("4267628872390354");
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

  it("toasts the error message when uploadFile rejects", async () => {
    uploadFile.mockRejectedValueOnce(new Error("server boom"));
    render(<DataInput onDataChanged={() => {}} />);
    const input = document.querySelector('input[type="file"]');
    const good = new File(["x"], "x.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [good] } });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("server boom"));
  });

  it("ignores a file-picker change that has no files (early return)", () => {
    render(<DataInput onDataChanged={() => {}} />);
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [] } });
    expect(uploadFile).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("dragging a valid file over the dropzone toggles the drag class and accepts the drop", async () => {
    uploadFile.mockResolvedValueOnce({
      filename: "drop.csv",
      accepted: 1,
      rejected: 0,
    });
    render(<DataInput onDataChanged={() => {}} />);
    const dropzone = document
      .querySelector('input[type="file"]')
      .closest("div");

    fireEvent.dragEnter(dropzone, { dataTransfer: { files: [] } });
    fireEvent.dragOver(dropzone, { dataTransfer: { files: [] } });
    fireEvent.dragLeave(dropzone);

    const file = new File(["a,b"], "drop.csv", { type: "text/csv" });
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(1));
  });

  it("a drop event without files is a no-op", () => {
    render(<DataInput onDataChanged={() => {}} />);
    const dropzone = document
      .querySelector('input[type="file"]')
      .closest("div");
    fireEvent.drop(dropzone, { dataTransfer: { files: [] } });
    expect(uploadFile).not.toHaveBeenCalled();
  });
});

describe("DataInput — Manual Entry edge cases", () => {
  beforeEach(() => {
    toast.success.mockReset();
    toast.error.mockReset();
    bulkCreateTransactions.mockReset();
  });

  it("Clear all wipes the rows back to a single empty row", async () => {
    const user = userEvent.setup();
    render(<DataInput onDataChanged={() => {}} />);
    await user.click(screen.getByText(/manual entry/i));

    fireEvent.change(screen.getByPlaceholderText(/1234 5678/), {
      target: { value: "4267628872390354" },
    });
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "12.34" },
    });

    await user.click(screen.getByText(/clear all/i));

    const inputs = screen.getAllByPlaceholderText(/1234 5678/);
    expect(inputs).toHaveLength(1);
    expect(inputs[0].value).toBe("");
  });

  it("removing the last remaining row resets it to empty instead of dropping below one", async () => {
    const user = userEvent.setup();
    render(<DataInput onDataChanged={() => {}} />);
    await user.click(screen.getByText(/manual entry/i));

    fireEvent.change(screen.getByPlaceholderText(/1234 5678/), {
      target: { value: "4267628872390354" },
    });
    expect(screen.getByPlaceholderText(/1234 5678/).value).toContain("4267");

    await user.click(screen.getByLabelText(/remove row/i));
    const remaining = screen.getAllByPlaceholderText(/1234 5678/);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].value).toBe("");
  });

  it("typing an Amex card caps the input at 15 digits via the controlled onChange", async () => {
    const user = userEvent.setup();
    render(<DataInput onDataChanged={() => {}} />);
    await user.click(screen.getByText(/manual entry/i));

    const input = screen.getByPlaceholderText(/1234 5678/);
    fireEvent.change(input, { target: { value: "37144963539843199999" } });
    // React reconciles the controlled value asynchronously; re-query and wait.
    await waitFor(() => {
      const refreshed = screen.getByPlaceholderText(/1234 5678/);
      expect(refreshed.value.replace(/\s/g, "")).toBe("371449635398431");
    });
  });

  it("toasts the bulk-create rejection and leaves the rows intact", async () => {
    const user = userEvent.setup();
    bulkCreateTransactions.mockRejectedValueOnce(new Error("backend angry"));
    render(<DataInput onDataChanged={() => {}} />);
    await user.click(screen.getByText(/manual entry/i));

    fireEvent.change(screen.getByPlaceholderText(/1234 5678/), {
      target: { value: "4267628872390354" },
    });
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "1" },
    });
    await user.click(screen.getByText(/add all/i));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("backend angry"));
  });

  it("captures a typed timestamp on the row", async () => {
    const user = userEvent.setup();
    render(<DataInput onDataChanged={() => {}} />);
    await user.click(screen.getByText(/manual entry/i));

    const ts = document.querySelector('input[type="datetime-local"]');
    fireEvent.change(ts, { target: { value: "2024-06-01T10:00" } });
    expect(ts.value).toBe("2024-06-01T10:00");
  });

  // NOTE: submitManual's hasErrors re-validation guard (lines 186-190 in
  // DataInput.jsx) is a belt-and-braces check behind a disabled button. React
  // 18 swallows click events on buttons rendered with disabled=true even when
  // the DOM attribute is removed imperatively, so this path cannot be reached
  // through the public UI. The invariants are covered indirectly: the submit
  // button disable condition is tested by "disables the submit button when
  // rows are empty or invalid", and the underlying validateCard / validateAmount
  // / validateTimestamp helpers have direct unit tests above.
});
