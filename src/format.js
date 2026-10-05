import { currentCurrencyConfig } from "./currency.js";

// The symbol for whichever currency is picked in Profile — use this instead
// of a hardcoded "₱" anywhere a symbol is drawn on its own (inputs, hints).
export function currencySymbol() {
  return currentCurrencyConfig().symbol;
}

// Display-only: formats the same number with the chosen currency's symbol,
// grouping and decimals. It never converts between currencies.
export function fmt(n) {
  const cfg = currentCurrencyConfig();
  const num = Number(n) || 0;
  const digits = cfg.decimals ?? 2;
  const abs = Math.abs(num).toLocaleString(cfg.locale || "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${num < 0 ? "-" : ""}${cfg.symbol}${abs}`;
}

export function uid(prefix = "t") {
  return prefix + Date.now() + Math.random().toString(16).slice(2, 8);
}

export function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// "2 hours ago" / "3 days ago" style, for full ISO timestamps (not the plain
// date strings formatDate() handles) — used for session/device last-active times.
export function timeAgo(isoTimestamp) {
  if (!isoTimestamp) return "";
  const then = new Date(isoTimestamp).getTime();
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

export function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

export function csvEscape(v) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
