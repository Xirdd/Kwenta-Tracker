import { DATA } from "./state.js";
import { catInfo, incCatInfo } from "./categories.js";
import { csvEscape } from "./format.js";

export function exportCSV() {
  const rows = [["Date", "Type", "Category", "Description", "Amount"]];

  Object.entries(DATA.salary).forEach(([mk, amt]) => {
    if (amt) rows.push([mk + "-01", "Income", "Salary", "Monthly salary", amt]);
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
  a.download =
    "kwenta_export_" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
