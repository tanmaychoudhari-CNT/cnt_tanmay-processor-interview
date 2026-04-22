import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const signIn = vi.fn();
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ signIn }),
}));

vi.mock("../api/api", () => ({
  errorMessage: (e) => e?.message ?? "err",
}));

import Login from "./Login";

describe("Login page", () => {
  it("renders the form with the default credentials prefilled", () => {
    render(<Login />);
    expect(screen.getByDisplayValue("admin")).toBeInTheDocument();
    expect(screen.getByDisplayValue("admin123")).toBeInTheDocument();
  });

  it("calls signIn(username, password) when the form is submitted", async () => {
    signIn.mockClear();
    signIn.mockResolvedValueOnce({ username: "admin" });
    render(<Login />);
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    expect(signIn).toHaveBeenCalledWith("admin", "admin123");
  });

  it("shows an error message when signIn rejects", async () => {
    signIn.mockClear();
    signIn.mockRejectedValueOnce(new Error("Invalid credentials"));
    render(<Login />);
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() =>
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument()
    );
  });

  it("toggles the password visibility", async () => {
    render(<Login />);
    // Re-query the input after each click — React may swap the DOM node when
    // the `type` attribute changes, so holding onto a ref goes stale.
    expect(screen.getByDisplayValue("admin123")).toHaveAttribute(
      "type",
      "password"
    );
    await userEvent.click(screen.getByLabelText(/show password/i));
    await waitFor(() =>
      expect(screen.getByDisplayValue("admin123")).toHaveAttribute(
        "type",
        "text"
      )
    );
    await userEvent.click(screen.getByLabelText(/hide password/i));
    await waitFor(() =>
      expect(screen.getByDisplayValue("admin123")).toHaveAttribute(
        "type",
        "password"
      )
    );
  });
});
