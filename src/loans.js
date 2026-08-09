import { DATA, saveData } from "./state.js";
import { uid } from "./format.js";
import {
  isCloudMode,
  cloudUpsertLoan,
  cloudDeleteLoan,
  cloudUpsertTransaction,
  cloudDeleteTransaction,
} from "./sync.js";
import { notifySyncError } from "./toast.js";

const LOAN_CATEGORY = "utang";

export function getLoan(id) {
  return DATA.loans.find((l) => l.id === id);
}

// direction: 'lent' (they owe you) | 'borrowed' (you owe them)
export function createLoan({ person, direction, amount, date, note }) {
  const loan = {
    id: uid(),
    person,
    direction,
    amount,
    date,
    note: note || undefined,
    active: true,
  };
  DATA.loans.push(loan);

  // The moment money changes hands is a real cash movement — logged immediately.
  const principalTx = {
    id: uid(),
    type: direction === "lent" ? "expense" : "income",
    desc: person,
    amount,
    category: LOAN_CATEGORY,
    date,
    loanId: loan.id,
    loanKind: "principal",
  };
  DATA.transactions.push(principalTx);

  saveData();
  if (isCloudMode()) {
    cloudUpsertLoan(loan).catch((e) => notifySyncError(e));
    cloudUpsertTransaction(principalTx).catch((e) => notifySyncError(e));
  }
  return loan;
}

// Direction isn't editable on purpose — flipping it after repayments exist
// would be ambiguous. Delete and re-add if the direction was wrong.
export function updateLoan(loan, { person, amount, date, note }) {
  loan.person = person;
  loan.amount = amount;
  loan.date = date;
  loan.note = note || undefined;
  saveData();

  const principalTx = DATA.transactions.find(
    (t) => t.loanId === loan.id && t.loanKind === "principal",
  );
  if (principalTx) {
    principalTx.desc = person;
    principalTx.amount = amount;
    principalTx.date = date;
    if (isCloudMode())
      cloudUpsertTransaction(principalTx).catch((e) => notifySyncError(e));
  }
  if (isCloudMode()) cloudUpsertLoan(loan).catch((e) => notifySyncError(e));
}

export function deleteLoan(id) {
  DATA.loans = DATA.loans.filter((l) => l.id !== id);
  saveData();
  if (isCloudMode()) cloudDeleteLoan(id).catch((e) => notifySyncError(e));
}

export function transactionsFor(loanId) {
  return DATA.transactions
    .filter((t) => t.loanId === loanId)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

export function repaymentsFor(loanId) {
  return transactionsFor(loanId).filter((t) => t.loanKind === "repayment");
}

export function remainingAmount(loan) {
  const repaid = repaymentsFor(loan.id).reduce(
    (s, t) => s + Number(t.amount || 0),
    0,
  );
  return Math.max(0, loan.amount - repaid);
}

export function isSettled(loan) {
  return remainingAmount(loan) <= 0;
}

export function addRepayment(loan, { amount, date }) {
  const tx = {
    id: uid(),
    type: loan.direction === "lent" ? "income" : "expense",
    desc: loan.person,
    amount,
    category: LOAN_CATEGORY,
    date,
    loanId: loan.id,
    loanKind: "repayment",
  };
  DATA.transactions.push(tx);
  saveData();
  if (isCloudMode())
    cloudUpsertTransaction(tx).catch((e) => notifySyncError(e));
  return tx;
}

export function removeRepayment(tx) {
  DATA.transactions = DATA.transactions.filter((t) => t.id !== tx.id);
  saveData();
  if (isCloudMode())
    cloudDeleteTransaction(tx.id).catch((e) => notifySyncError(e));
}

// Named loanTotals (not totals) to avoid clashing with state.js's totals().
export function loanTotals() {
  let owedToYou = 0;
  let youOwe = 0;
  DATA.loans.forEach((loan) => {
    const remaining = remainingAmount(loan);
    if (loan.direction === "lent") owedToYou += remaining;
    else youOwe += remaining;
  });
  return { owedToYou, youOwe };
}
