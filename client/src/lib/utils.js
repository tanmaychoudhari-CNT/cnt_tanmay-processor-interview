import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount) {
  const n = Number(amount ?? 0);
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function formatNumber(value) {
  return Number(value ?? 0).toLocaleString("en-US");
}

export function maskCard(card, keep = 4) {
  const s = String(card ?? "");
  if (s.length <= keep) return s;
  return `•••• ${s.slice(-keep)}`;
}

// Show only the first 2 and last 4 digits, everything else masked with "*".
// e.g. "4267628872390355" -> "42**********0355"
export function maskCardNumber(card) {
  const digits = String(card ?? "").replace(/\s/g, "");
  if (digits.length <= 6) return digits;
  const head = digits.slice(0, 2);
  const tail = digits.slice(-4);
  return head + "*".repeat(digits.length - 6) + tail;
}
