// Tiny shared utilities used across the dashboard.

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Compose conditional Tailwind class strings and de-dupe conflicts
// (e.g. `px-2 px-4` → `px-4`). Standard shadcn-style helper.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// USD currency format. Accepts numbers, numeric strings, null, undefined —
// everything gets coerced to a number first and null/undefined become 0.
export function formatCurrency(amount) {
  const n = Number(amount ?? 0);
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

// Locale-aware number formatting (thousands separators).
export function formatNumber(value) {
  return Number(value ?? 0).toLocaleString("en-US");
}

// Compact "last-4" mask — used in narrow contexts (tooltips, chips) where
// the full masked number doesn't fit. For grid rows use maskCardNumber.
export function maskCard(card, keep = 4) {
  const s = String(card ?? "");
  if (s.length <= keep) return s;
  return `•••• ${s.slice(-keep)}`;
}

// Show only the first 2 and last 4 digits, everything else masked with "*".
// e.g. "4267628872390355" -> "42**********0355".
// Cards with ≤ 6 digits are returned as-is — there's nothing meaningful
// left to mask once you strip head/tail.
export function maskCardNumber(card) {
  const digits = String(card ?? "").replace(/\s/g, "");
  if (digits.length <= 6) return digits;
  const head = digits.slice(0, 2);
  const tail = digits.slice(-4);
  return head + "*".repeat(digits.length - 6) + tail;
}
