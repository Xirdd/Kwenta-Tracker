import "./searchSheet.css";
import { DATA, state, periodKeyOf } from "../state.js";
import { catInfo, incCatInfo } from "../categories.js";
import { fmt, formatDate, escapeHtml } from "../format.js";
import { openModal, closeModal } from "./modal.js";
import { openForm } from "./sheet.js";
import { openBillPaymentSheet } from "./billSheet.js";
import { openGoalDetail } from "./goalSheet.js";
import { openLoanDetail } from "./loanSheet.js";
import { getBill } from "../bills.js";
import { getGoal } from "../goals.js";
import { getLoan } from "../loans.js";

let onNavigate = () => {};

// Called once from main.js — after jumping the app to wherever a result
// lives (its period, its tab), this triggers the same full re-render main.js
// already uses everywhere else, so the screen behind the detail sheet that
// opens next is correct too.
export function initSearchSheet(rerenderCallback) {
  onNavigate = rerenderCallback;
}

const MAX_PER_GROUP = 6;

function searchTransactions(q, type) {
  return DATA.transactions
    .filter((t) => t.type === type)
    .filter((t) => {
      const cat =
        type === "expense" ? catInfo(t.category) : incCatInfo(t.category);
      const desc = (t.desc || "").toLowerCase();
      const tagsMatch = (t.tags || []).some((tag) =>
        tag.toLowerCase().includes(q),
      );
      return (
        desc.includes(q) || cat.label.toLowerCase().includes(q) || tagsMatch
      );
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, MAX_PER_GROUP);
}

function searchBills(q) {
  return DATA.bills
    .filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.customCategory || "").toLowerCase().includes(q),
    )
    .slice(0, MAX_PER_GROUP);
}

function searchGoals(q) {
  return DATA.goals
    .filter((g) => g.name.toLowerCase().includes(q))
    .slice(0, MAX_PER_GROUP);
}

function searchLoans(q) {
  return DATA.loans
    .filter(
      (l) =>
        l.person.toLowerCase().includes(q) ||
        (l.note || "").toLowerCase().includes(q),
    )
    .slice(0, MAX_PER_GROUP);
}

function txRow(tx, type) {
  const cat =
    type === "expense" ? catInfo(tx.category) : incCatInfo(tx.category);
  return `
  <div class="search-result-row" data-tx="${tx.id}" data-tx-type="${type}">
    <div class="info">
      <div class="desc">${escapeHtml(tx.desc || cat.label)}</div>
      <div class="meta">${cat.label} · ${formatDate(tx.date)}</div>
    </div>
    <div class="amt" style="color:${type === "expense" ? "var(--coral)" : "var(--green)"}">${type === "expense" ? "-" : "+"}${fmt(tx.amount)}</div>
  </div>`;
}

function billRow(bill) {
  const c = catInfo(bill.category);
  return `
  <div class="search-result-row" data-bill-id="${bill.id}">
    <div class="info">
      <div class="desc">${escapeHtml(bill.name)}</div>
      <div class="meta">${escapeHtml(bill.customCategory || c.label)} · due on the ${bill.dueDay}</div>
    </div>
  </div>`;
}

function goalRow(goal) {
  return `
  <div class="search-result-row" data-goal-id="${goal.id}">
    <div class="info">
      <div class="desc">${escapeHtml(goal.name)}</div>
      <div class="meta">Target ${fmt(goal.targetAmount)}</div>
    </div>
  </div>`;
}

function loanRow(loan) {
  return `
  <div class="search-result-row" data-loan-id="${loan.id}">
    <div class="info">
      <div class="desc">${escapeHtml(loan.person)}</div>
      <div class="meta">${loan.direction === "lent" ? "Owes you" : "You owe"} · ${fmt(loan.amount)}</div>
    </div>
  </div>`;
}

function renderResults(q) {
  if (!q) {
    return `<p class="auth-message" style="margin-top:14px;">Search expenses, income, bills, goals, and utang — all at once.</p>`;
  }

  const expenses = searchTransactions(q, "expense");
  const income = searchTransactions(q, "income");
  const bills = searchBills(q);
  const goals = searchGoals(q);
  const loans = searchLoans(q);
  const total =
    expenses.length +
    income.length +
    bills.length +
    goals.length +
    loans.length;

  if (total === 0) {
    return `<p class="auth-message" style="margin-top:14px;">No matches for "${escapeHtml(q)}".</p>`;
  }

  return `
    ${expenses.length ? `<div class="search-group-label">Expenses</div>${expenses.map((t) => txRow(t, "expense")).join("")}` : ""}
    ${income.length ? `<div class="search-group-label">Income</div>${income.map((t) => txRow(t, "income")).join("")}` : ""}
    ${bills.length ? `<div class="search-group-label">Bills</div>${bills.map(billRow).join("")}` : ""}
    ${goals.length ? `<div class="search-group-label">Goals</div>${goals.map(goalRow).join("")}` : ""}
    ${loans.length ? `<div class="search-group-label">Utang</div>${loans.map(loanRow).join("")}` : ""}
  `;
}

export function openSearchSheet() {
  openModal(`
    <div class="grabber"></div>
    <div class="search-sheet-input-wrap">
      <input id="globalSearchInput" type="search" placeholder="Search everything…" autofocus/>
    </div>
    <div id="searchResultsWrap">${renderResults("")}</div>
  `);

  const input = document.getElementById("globalSearchInput");
  input.focus();
  input.oninput = () => {
    document.getElementById("searchResultsWrap").innerHTML = renderResults(
      input.value.trim().toLowerCase(),
    );
    wireResultRows();
  };
  wireResultRows();
}

// Points the app at wherever a result actually lives, then opens its own
// detail sheet on top — e.g. tapping an old expense jumps Overview to that
// expense's half-month period and the Expenses tab, THEN opens it for
// editing, so what's behind the sheet is correct if the person closes it.
function wireResultRows() {
  document.querySelectorAll("[data-tx]").forEach((row) => {
    row.onclick = () => {
      const tx = DATA.transactions.find((t) => t.id === row.dataset.tx);
      if (!tx) return;
      closeModal();
      state.section = "overview";
      state.tab = row.dataset.txType === "expense" ? "expenses" : "income";
      state.monthKey = periodKeyOf(new Date(tx.date));
      onNavigate();
      openForm(row.dataset.txType, tx);
    };
  });
  document.querySelectorAll("[data-bill-id]").forEach((row) => {
    row.onclick = () => {
      const bill = getBill(row.dataset.billId);
      if (!bill) return;
      closeModal();
      state.section = "overview";
      state.tab = "bills";
      onNavigate();
      openBillPaymentSheet(bill, currentRealMonthKey());
    };
  });
  document.querySelectorAll("[data-goal-id]").forEach((row) => {
    row.onclick = () => {
      const goal = getGoal(row.dataset.goalId);
      if (!goal) return;
      closeModal();
      state.section = "goals";
      onNavigate();
      openGoalDetail(goal);
    };
  });
  document.querySelectorAll("[data-loan-id]").forEach((row) => {
    row.onclick = () => {
      const loan = getLoan(row.dataset.loanId);
      if (!loan) return;
      closeModal();
      state.section = "loans";
      onNavigate();
      openLoanDetail(loan);
    };
  });
}
