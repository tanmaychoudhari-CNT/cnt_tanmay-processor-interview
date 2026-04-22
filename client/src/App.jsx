import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import { ToastProvider } from "./hooks/useToast";
import { ProtectedRoute, PublicOnlyRoute } from "./routes/guards";

// Top-level route table. Auth is enforced by the route guards, not at the
// component level — Login never renders for a signed-in user and Dashboard
// never renders for a signed-out one. See routes/guards.jsx.
export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        {/* Unknown paths fall back to the dashboard (which itself enforces auth). */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}
