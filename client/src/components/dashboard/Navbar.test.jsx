import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const signOut = vi.fn();
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ signOut }),
}));

import Navbar from "./Navbar";

describe("Navbar", () => {
  it("shows the passed-in username", () => {
    render(<Navbar username="admin" />);
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText(/administrator/i)).toBeInTheDocument();
  });

  it("triggers signOut when the sign-out button is clicked", async () => {
    signOut.mockClear();
    render(<Navbar username="admin" />);
    await userEvent.click(screen.getByLabelText(/sign out/i));
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("renders the Signapay logo", () => {
    render(<Navbar username="admin" />);
    expect(screen.getByAltText(/signapay/i)).toBeInTheDocument();
  });
});
