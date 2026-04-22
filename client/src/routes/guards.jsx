// Route-level auth guards.
//
// Both guards depend on AuthContext's `loading` flag — the first render
// after a page reload has `user === null` *before* the /me round-trip
// finishes, so guarding on user alone would flash the login screen.

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function AuthSpinner() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );
}

// Wraps authenticated pages. If the user isn't signed in we bounce to /login
// and remember the intended destination so we can return them there after
// a successful login.
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthSpinner />;
  if (!user) {
    return (
      <Navigate to="/login" replace state={{ from: location }} />
    );
  }
  return children;
}

// Wraps pages that only make sense when signed out (the login screen).
// If the user is already signed in we send them to whatever page they
// originally wanted (or the dashboard root).
export function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthSpinner />;
  if (user) {
    const to = location.state?.from?.pathname ?? "/";
    return <Navigate to={to} replace />;
  }
  return children;
}
