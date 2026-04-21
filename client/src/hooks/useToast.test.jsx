import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider, useToast } from "./useToast";

// Trigger buttons and toast messages use distinct strings so we can assert on
// the toast text alone without matching the trigger button itself.
function Probe() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success("saved ok")}>trigger-success</button>
      <button onClick={() => toast.error("boom")}>trigger-error</button>
      <button onClick={() => toast.info("fyi")}>trigger-info</button>
    </div>
  );
}

describe("useToast / ToastProvider", () => {
  it("renders a success toast when success() is called", async () => {
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>
    );
    await userEvent.click(screen.getByText("trigger-success"));
    expect(screen.getByText("saved ok")).toBeInTheDocument();
  });

  it("renders an error toast when error() is called", async () => {
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>
    );
    await userEvent.click(screen.getByText("trigger-error"));
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("renders an info toast when info() is called", async () => {
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>
    );
    await userEvent.click(screen.getByText("trigger-info"));
    expect(screen.getByText("fyi")).toBeInTheDocument();
  });

  describe("auto-dismiss", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("removes the toast after the default 3.5s", () => {
      render(
        <ToastProvider>
          <Probe />
        </ToastProvider>
      );
      act(() => {
        screen.getByText("trigger-error").click();
      });
      expect(screen.getByText("boom")).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(3500));
      expect(screen.queryByText("boom")).not.toBeInTheDocument();
    });
  });

  it("throws when useToast is called outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/useToast must be used/);
    spy.mockRestore();
  });
});
