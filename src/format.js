export function fmt(n) {
  const num = Number(n) || 0;
  return (
    "₱" +
    num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
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
  // Formula injection: a field starting with = + - @ (or a tab/CR) gets
  // executed as a formula by Excel/Sheets when the CSV is opened — a real
  // risk here since household members can export data others typed. A
  // leading apostrophe forces "treat as text" and is hidden in the cell
  // display, so this doesn't change what a human sees.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
