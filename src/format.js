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
