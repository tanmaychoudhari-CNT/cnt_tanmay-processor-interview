import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// We don't want to exercise real auth HTTP here — stub AuthContext.useAuth
// directly so each test can drive `user` / `loading` deterministically.
const mockAuth = vi.fn();
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => mockAuth(),
}));

import { ProtectedRoute, PublicOnlyRoute } from "../../src/routes/guards";

function renderAt(url, element) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/login" element={<div>LOGIN</div>} />
        <Route path="/" element={<div>HOME</div>} />
        <Route path="/secret" element={element} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  it("redirects to /login when there is no user", () => {
    mockAuth.mockReturnValue({ user: null, loading: false });
    renderAt(
      "/secret",
      <ProtectedRoute>
        <div>SECRET</div>
      </ProtectedRoute>
    );
    expect(screen.getByText("LOGIN")).toBeInTheDocument();
  });

  it("renders its children when the user is signed in", () => {
    mockAuth.mockReturnValue({ user: { username: "admin" }, loading: false });
    renderAt(
      "/secret",
      <ProtectedRoute>
        <div>SECRET</div>
      </ProtectedRoute>
    );
    expect(screen.getByText("SECRET")).toBeInTheDocument();
  });

  it("renders a spinner while auth is still loading (no redirect yet)", () => {
    mockAuth.mockReturnValue({ user: null, loading: true });
    const { container } = renderAt(
      "/secret",
      <ProtectedRoute>
        <div>SECRET</div>
      </ProtectedRoute>
    );
    // Neither the login page nor the children — the spinner takes over.
    expect(screen.queryByText("LOGIN")).not.toBeInTheDocument();
    expect(screen.queryByText("SECRET")).not.toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });
});

describe("PublicOnlyRoute", () => {
  it("renders its children when the user is signed out", () => {
    mockAuth.mockReturnValue({ user: null, loading: false });
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <div>LOGIN_FORM</div>
              </PublicOnlyRoute>
            }
          />
          <Route path="/" element={<div>HOME</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("LOGIN_FORM")).toBeInTheDocument();
  });

  it("redirects to / when the user is already signed in", () => {
    mockAuth.mockReturnValue({ user: { username: "admin" }, loading: false });
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <div>LOGIN_FORM</div>
              </PublicOnlyRoute>
            }
          />
          <Route path="/" element={<div>HOME</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("HOME")).toBeInTheDocument();
  });

  it("renders a spinner while auth is loading", () => {
    mockAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <div>LOGIN_FORM</div>
              </PublicOnlyRoute>
            }
          />
          <Route path="/" element={<div>HOME</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText("LOGIN_FORM")).not.toBeInTheDocument();
    expect(screen.queryByText("HOME")).not.toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("redirects an already-signed-in user back to the page they originally wanted", () => {
    // ProtectedRoute records the original location in state.from when it kicks
    // an unauthenticated user to /login. PublicOnlyRoute reads that on a
    // subsequent render so the user lands back where they started after
    // signing in.
    mockAuth.mockReturnValue({ user: { username: "admin" }, loading: false });
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/login", state: { from: { pathname: "/secret-page" } } },
        ]}
      >
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <div>LOGIN_FORM</div>
              </PublicOnlyRoute>
            }
          />
          <Route path="/" element={<div>HOME</div>} />
          <Route path="/secret-page" element={<div>SECRET</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("SECRET")).toBeInTheDocument();
  });
});
