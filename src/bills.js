import { DATA, saveData, monthKeyOf } from "./state.js";
import { uid } from "./format.js";
import {
  isCloudMode,
  cloudUpsertBill,
  cloudDeleteBill,
  cloudUpsertTransaction,
  cloudDeleteTransaction,
} from "./sync.js";

export function getBill(id) {
  return DATA.bills.find((b) => b.id === id);
}

export function createBill({ name, category, dueDay, estimatedAmount }) {
  const bill = {
    id: uid(),
    name,
    category,
    dueDay: clampDay(dueDay),
    estimatedAmount: estimatedAmount || undefined,
    active: true,
  };
  DATA.bills.push(bill);
  saveData();
  if (isCloudMode())
    cloudUpsertBill(bill).catch((e) => console.error("Cloud sync failed", e));
  return bill;
}

export function updateBill(bill, { name, category, dueDay, estimatedAmount }) {
  bill.name = name;
  bill.category = category;
  bill.dueDay = clampDay(dueDay);
  bill.estimatedAmount = estimatedAmount || undefined;
  saveData();
  if (isCloudMode())
    cloudUpsertBill(bill).catch((e) => console.error("Cloud sync failed", e));
}

export function deleteBill(id) {
  DATA.bills = DATA.bills.filter((b) => b.id !== id);
  saveData();
  if (isCloudMode())
    cloudDeleteBill(id).catch((e) => console.error("Cloud sync failed", e));
}

function clampDay(day) {
  return Math.min(Math.max(Number(day) || 1, 1), 28); // valid in every month, including February
}

export function findPaymentTx(billId, monthKey) {
  return DATA.transactions.find(
    (t) => t.billId === billId && t.date && t.date.startsWith(monthKey),
  );
}

// Records a payment for the given month as a real expense transaction, linked back to the bill.
export function markBillPaid(bill, monthKey, { amount, date }) {
  const tx = {
    id: uid(),
    type: "expense",
    desc: bill.name,
    amount,
    category: bill.category,
    date,
    billId: bill.id,
  };
  DATA.transactions.push(tx);
  saveData();
  if (isCloudMode())
    cloudUpsertTransaction(tx).catch((e) =>
      console.error("Cloud sync failed", e),
    );
  return tx;
}

export function undoBillPayment(tx) {
  DATA.transactions = DATA.transactions.filter((t) => t.id !== tx.id);
  saveData();
  if (isCloudMode())
    cloudDeleteTransaction(tx.id).catch((e) =>
      console.error("Cloud sync failed", e),
    );
}

export function dueDateStr(monthKey, dueDay) {
  return `${monthKey}-${String(dueDay).padStart(2, "0")}`;
}

export function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  return Math.round((due - today) / 86400000);
}

export function currentRealMonthKey() {
  return monthKeyOf(new Date());
}

export function ordinalSuffix(n) {
  if (n % 10 === 1 && n % 100 !== 11) return "st";
  if (n % 10 === 2 && n % 100 !== 12) return "nd";
  if (n % 10 === 3 && n % 100 !== 13) return "rd";
  return "th";
}

// Unpaid bills due within the next 7 days (or already overdue), for the Overview widget.
// Only meaningful when looking at the real current month.
export function upcomingBills(limit = 3) {
  const monthKey = currentRealMonthKey();
  return DATA.bills
    .filter((b) => b.active !== false)
    .map((bill) => ({
      bill,
      daysLeft: daysUntil(dueDateStr(monthKey, bill.dueDay)),
    }))
    .filter(
      ({ bill, daysLeft }) =>
        !findPaymentTx(bill.id, monthKey) && daysLeft <= 7,
    )
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, limit);
}
