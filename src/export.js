import { DATA, periodRange, periodKeyHasHalf, monthLabel } from "./state.js";
import { catInfo, incCatInfo } from "./categories.js";
import { csvEscape, todayISO } from "./format.js";

export function exportCSV() {
  const rows = [["Date", "Type", "Category", "Description", "Amount"]];

  // Salary is keyed by PERIOD ("2026-09" or "2026-09-1"), not by a date. The
  // old code wrote `key + "-01"`, which produced "2026-09-1-01" for
  // semi-monthly keys — not a date at all. The row's date is now that
  // period's first day.
  Object.entries(DATA.salary).forEach(([key, amt]) => {
    if (!amt) return;
    rows.push([
      periodRange(key).start,
      "Income",
      "Salary",
      periodKeyHasHalf(key) ? `Salary, ${monthLabel(key)}` : "Monthly salary",
      amt,
    ]);
  });

  DATA.transactions
    .slice()
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .forEach((tx) => {
      const label =
        tx.type === "expense"
          ? catInfo(tx.category).label
          : incCatInfo(tx.category).label;
      rows.push([
        tx.date || "",
        tx.type === "expense" ? "Expense" : "Income",
        label,
        tx.desc || "",
        tx.amount,
      ]);
    });

  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kwenta_export_" + todayISO() + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
