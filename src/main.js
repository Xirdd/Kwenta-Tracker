import "./style.css";

import {
  state,
  DATA,
  initData,
  shiftMonth,
  totals,
  switchToCloudData,
  switchToLocalData,
} from "./state.js";
import { materializeMonth } from "./recurring.js";
import { getBill } from "./bills.js";
import { getGoal } from "./goals.js";
import { getLoan } from "./loans.js";
import { renderHeader } from "./components/header.js";
import { renderMonthNav } from "./components/monthNav.js";
import { renderLedgerCard } from "./components/ledgerCard.js";
import { renderTabs } from "./components/tabs.js";
import { renderBottomNav } from "./components/bottomNav.js";
import { renderOverview } from "./components/overview.js";
import { renderIncome, attachIncomeEvents } from "./components/income.js";
import { renderExpenses, attachExpenseEvents } from "./components/expenses.js";
import { renderBudgets, attachBudgetEvents } from "./components/budgets.js";
import { renderBills } from "./components/billsTab.js";
import { renderGoalsTab } from "./components/goalsTab.js";
import { renderLoansTab } from "./components/loansTab.js";
import { initSheet, openForm } from "./components/sheet.js";
import {
  initBillSheets,
  openBillForm,
  openBillPaymentSheet,
} from "./components/billSheet.js";
import {
  initGoalSheets,
  openGoalForm,
  openGoalDetail,
} from "./components/goalSheet.js";
import {
  initLoanSheets,
  openLoanForm,
  openLoanDetail,
} from "./components/loanSheet.js";
import { exportCSV } from "./export.js";
import { initTheme, toggleTheme } from "./theme.js";
import {
  initAuth,
  getCurrentUser,
  onAuthChange,
  consumePendingPasswordSetup,
} from "./auth.js";
import { getActiveHousehold, loadActiveHousehold } from "./household.js";
import { openAuthSheet } from "./components/authSheet.js";
import { openAccountSheet } from "./components/accountSheet.js";
import { openSetPasswordSheet } from "./components/setPasswordSheet.js";
import {
  initHouseholdSheet,
  openHouseholdSheet,
} from "./components/householdSheet.js";

function render() {
  const t = totals();
  const user = getCurrentUser();
  const household = getActiveHousehold();
  const app = document.getElementById("app");
  app.innerHTML = `
    ${renderHeader(user, household)}
    <div class="side">
      ${renderMonthNav()}
      ${renderLedgerCard(t)}
      ${state.section === "overview" ? renderTabs() : ""}
    </div>
    <div class="content-panel">
      ${renderSectionContent(t)}
    </div>
  `;
  app.insertAdjacentHTML(
    "beforeend",
    `<button class="fab" id="fabBtn">+</button>`,
  );
  app.insertAdjacentHTML("beforeend", renderBottomNav());
  attachEvents();
}

// Overview owns the existing sub-tabs (Overview/Income/Expenses/Budgets/Bills).
// Goals and Utang are full screens with no sub-tabs of their own.
function renderSectionContent(t) {
  if (state.section === "goals") return renderGoalsTab();
  if (state.section === "loans") return renderLoansTab();
  return `
    ${state.tab === "overview" ? renderOverview(t) : ""}
    ${state.tab === "income" ? renderIncome(t) : ""}
    ${state.tab === "expenses" ? renderExpenses(t) : ""}
    ${state.tab === "budgets" ? renderBudgets(t) : ""}
    ${state.tab === "bills" ? renderBills() : ""}
  `;
}

// Ensures this month's recurring entries exist, then renders.
function goToMonth() {
  materializeMonth(state.monthKey);
  render();
}

// Called after creating/joining/leaving a household — the data scope itself
// changed, so this re-loads from the cloud (not just a re-render).
async function onHouseholdChanged() {
  await switchToCloudData();
  goToMonth();
}

function attachEvents() {
  document.getElementById("prevMonth").onclick = () => {
    shiftMonth(-1);
    goToMonth();
  };
  document.getElementById("nextMonth").onclick = () => {
    shiftMonth(1);
    goToMonth();
  };

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.onclick = () => {
      state.tab = btn.dataset.tab;
      render();
    };
  });

  document.querySelectorAll(".bottom-nav-btn").forEach((btn) => {
    btn.onclick = () => {
      state.section = btn.dataset.section;
      render();
    };
  });

  document.getElementById("fabBtn").onclick = () => {
    if (state.section === "goals") {
      openGoalForm(null);
    } else if (state.section === "loans") {
      openLoanForm(null);
    } else if (state.tab === "bills") {
      openBillForm(null);
    } else {
      const type = state.tab === "income" ? "income" : "expense";
      openForm(type, null);
    }
  };

  document.getElementById("exportBtn").onclick = exportCSV;
  document.getElementById("themeToggle").onclick = () => {
    toggleTheme();
    render();
  };

  document.getElementById("accountBtn").onclick = () => {
    const user = getCurrentUser();
    if (user) openAccountSheet(user);
    else openAuthSheet();
  };

  const householdBadge = document.getElementById("householdBadge");
  if (householdBadge) householdBadge.onclick = openHouseholdSheet;

  attachIncomeEvents();
  attachBudgetEvents();
  attachExpenseEvents();

  document.querySelectorAll("[data-edit]").forEach((row) => {
    row.onclick = () => {
      const id = row.dataset.edit;
      const type = row.dataset.type;
      const tx = DATA.transactions.find((t) => t.id === id);
      if (tx) openForm(type, tx);
    };
  });

  // Bill rows appear both in the Bills tab and the Overview "Upcoming bills" widget.
  document.querySelectorAll("[data-bill]").forEach((row) => {
    row.onclick = () => {
      const bill = getBill(row.dataset.bill);
      const monthKey = row.dataset.month || state.monthKey;
      if (bill) openBillPaymentSheet(bill, monthKey);
    };
  });

  document.querySelectorAll("[data-goal]").forEach((row) => {
    row.onclick = () => {
      const goal = getGoal(row.dataset.goal);
      if (goal) openGoalDetail(goal);
    };
  });

  document.querySelectorAll("[data-loan]").forEach((row) => {
    row.onclick = () => {
      const loan = getLoan(row.dataset.loan);
      if (loan) openLoanDetail(loan);
    };
  });
}

(async function init() {
  initTheme();
  initSheet(render); // let sheets trigger a re-render after save/delete/sign-in/sign-out
  initBillSheets(render);
  initGoalSheets(render);
  initLoanSheets(render);
  initHouseholdSheet(onHouseholdChanged);

  const loadingEl = document.getElementById("app");
  loadingEl.innerHTML = `<div style="padding:60px 10px;text-align:center;color:var(--muted);font-family:Inter,sans-serif;font-size:13px;">Opening the ledger…</div>`;

  await initAuth();
  await loadActiveHousehold(); // must resolve before the first data load, since it decides what scope to load

  // Re-load and re-render whenever the signed-in user changes (sign in, sign out, magic link landing).
  let lastUserId = getCurrentUser()?.id || null;
  onAuthChange(async (user) => {
    const userId = user?.id || null;
    if (userId === lastUserId) return;
    lastUserId = userId;
    await loadActiveHousehold();
    if (user) {
      await switchToCloudData();
    } else {
      switchToLocalData();
    }
    goToMonth();
    if (user && consumePendingPasswordSetup()) {
      openSetPasswordSheet();
    }
  });

  await initData();
  goToMonth();
})();
