// Login screen. Two-pane layout: form on the left, marketing / product
// preview on the right (hidden under the `md` breakpoint on narrow
// viewports). The PublicOnlyRoute guard sends already-signed-in users
// straight to the dashboard.

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Lock,
  User as UserIcon,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../api/api";
import logoUrl from "../assets/signapay-logo.webp";

export default function Login() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // signIn persists the token + hydrates the user profile. On success
      // the route guard takes over and redirects to the dashboard.
      await signIn(username, password);
    } catch (err) {
      setError(errorMessage(err) || "Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[1100px] h-[750px] bg-white rounded-[32px] overflow-hidden shadow-2xl flex flex-col md:flex-row"
      >
        {/* Left section: form */}
        <div className="flex-1 p-12 lg:p-16 flex flex-col overflow-y-auto">
          <div className="mb-16">
            <img
              src={logoUrl}
              alt="Signapay"
              className="h-8 w-auto select-none"
              draggable={false}
            />
          </div>

          <div className="flex-1 flex flex-col justify-center max-w-[400px] mx-auto w-full">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-semibold text-gray-900 tracking-tight mb-3">
                Welcome back
              </h2>
              <p className="text-gray-500 text-sm font-normal">
                Enter your username and password to access your account.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider ml-1">
                  Username
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-gray-50/50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition-all outline-none text-sm"
                    placeholder="admin"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider ml-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-3.5 bg-gray-50/50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition-all outline-none text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center text-[12px] font-medium">
                <label className="flex items-center gap-2 text-gray-500 cursor-pointer group">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded-md border-gray-200 text-blue-600 focus:ring-blue-600"
                  />
                  <span className="group-hover:text-gray-700 transition-colors">
                    Remember me
                  </span>
                </label>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-2 text-red-600 text-xs font-medium bg-red-50 p-3 rounded-xl border border-red-100"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-medium text-sm tracking-wide hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Log in"
                )}
              </button>

            </form>

          </div>

          <div className="mt-auto pt-10 flex items-center justify-between text-[11px] font-normal text-gray-400">
            <span>© 2026 Signapay Ltd.</span>
            <a href="#" className="hover:text-gray-600 transition-colors">
              Privacy policy
            </a>
          </div>
        </div>

        {/* Right section: branding + product preview */}
        <div className="hidden md:flex flex-1 bg-blue-600 relative overflow-hidden p-12 lg:p-14 flex-col">
          {/* Dot pattern */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(#fff 2px, transparent 2px)",
              backgroundSize: "40px 40px",
            }}
          />
          {/* Soft glow blobs */}
          <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[100px] opacity-30" />
          <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-white rounded-full blur-[120px] opacity-10" />

          {/* Top row: logo + trust chip */}
          <div className="relative z-10 flex items-start justify-between">
            <img
              src={logoUrl}
              alt="Signapay"
              className="h-7 w-auto select-none brightness-0 invert opacity-90"
              draggable={false}
            />
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-white/80 bg-white/10 border border-white/15 rounded-full px-3 py-1 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              Secure · Tier 1
            </span>
          </div>

          {/* Hero copy */}
          <div className="relative z-10 mt-14 mb-8 max-w-[460px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/70 mb-4">
              The Signapay Processor
            </p>
            <h3 className="text-[34px] font-semibold text-white leading-[1.12] tracking-tight mb-4">
              Clear, classify and reconcile every transaction in one place.
            </h3>
            <p className="text-white/75 text-[14px] font-normal leading-relaxed">
              Ingest card batches, settle by brand, and watch volume in real
              time — purpose-built for high-throughput processors.
            </p>
          </div>

          {/* Product preview — a realistic "glance at the dashboard" card */}
          <div className="relative z-10 w-full max-w-[480px] rounded-[24px] bg-white/10 backdrop-blur-3xl border border-white/20 shadow-2xl p-4 overflow-hidden group">
            <div className="w-full rounded-[18px] bg-white overflow-hidden">
              {/* Mini browser chrome */}
              <div className="h-8 bg-gray-50 border-b border-gray-100 flex items-center px-4 gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <div className="w-2 h-2 rounded-full bg-yellow-400" />
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <div className="ml-3 flex-1 h-4 bg-white border border-gray-100 rounded-md" />
              </div>

              <div className="p-4 space-y-4">
                {/* Two KPI tiles with realistic content */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-gray-100 p-3">
                    <p className="text-[9px] uppercase tracking-[0.18em] text-gray-400 font-medium">
                      Today's volume
                    </p>
                    <p className="text-[18px] font-semibold text-gray-900 tabular-nums mt-1">
                      $2.48M
                    </p>
                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium text-emerald-600">
                      ▲ 12.4%
                    </span>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-3">
                    <p className="text-[9px] uppercase tracking-[0.18em] text-gray-400 font-medium">
                      Transactions
                    </p>
                    <p className="text-[18px] font-semibold text-gray-900 tabular-nums mt-1">
                      14,208
                    </p>
                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium text-blue-600">
                      Live feed
                    </span>
                  </div>
                </div>

                {/* Mini bar chart */}
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="flex items-end gap-1.5 h-16">
                    {[45, 62, 38, 70, 55, 85, 48, 72, 90, 58, 66, 80].map((h, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-sm ${
                          i % 3 === 2 ? "bg-blue-600" : "bg-blue-200"
                        }`}
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>

                {/* Brand chips */}
                <div className="flex items-center gap-2">
                  <span className="h-5 px-2 rounded-[3px] bg-[#1A1F71] flex items-center text-[8px] font-extrabold italic text-white">
                    VISA
                  </span>
                  <span className="h-5 px-2 rounded-[3px] bg-white border border-gray-200 flex items-center gap-[1px]">
                    <span className="w-2 h-2 rounded-full bg-[#EB001B] -mr-1" />
                    <span className="w-2 h-2 rounded-full bg-[#F79E1B] mix-blend-multiply" />
                  </span>
                  <span className="h-5 px-2 rounded-[3px] bg-[#006FCF] flex items-center text-[8px] font-extrabold text-white">
                    AMEX
                  </span>
                  <span className="h-5 px-2 rounded-[3px] bg-white border border-gray-200 flex items-center text-[7px] font-extrabold text-gray-900">
                    DISCOVER
                  </span>
                  <span className="ml-auto text-[10px] font-medium text-gray-400 tabular-nums">
                    +2 more
                  </span>
                </div>
              </div>
            </div>
            {/* Sheen on hover */}
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/0 via-white/10 to-blue-600/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />
          </div>

          {/* Stats rail */}
          <div className="relative z-10 mt-auto pt-10 grid grid-cols-3 gap-4 border-t border-white/15">
            <Stat value="$4.2B" label="Annual volume" />
            <Stat value="1,400+" label="Partners" />
            <Stat value="99.99%" label="Uptime" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div>
      <p className="text-[22px] font-semibold text-white tabular-nums tracking-tight leading-none">
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-medium mt-2">
        {label}
      </p>
    </div>
  );
}
