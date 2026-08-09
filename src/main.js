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
import {
  renderLoansTab,
  renderUtangLedgerCard,
} from "./components/loansTab.js";
import {
  renderProfileTab,
  attachProfileEvents,
  initProfileTab,
} from "./components/profileTab.js";
import { initDeleteAccountSheet } from "./components/deleteAccountSheet.js";
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
import { initTheme } from "./theme.js";
import {
  initAuth,
  getCurrentUser,
  onAuthChange,
  consumePendingPasswordSetup,
} from "./auth.js";
import {
  getActiveHousehold,
  getActiveHouseholdId,
  loadActiveHousehold,
} from "./household.js";
import { subscribeToHousehold, unsubscribeRealtime } from "./realtime.js";
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
      ${renderSideContent(t)}
    </div>
    <div class="content-panel">
      ${renderSectionContent(t)}
    </div>
  `;
  // Profile has nothing to "add", so no floating action button there.
  if (state.section !== "profile") {
    app.insertAdjacentHTML(
      "beforeend",
      `<button class="fab" id="fabBtn">+</button>`,
    );
  }
  app.insertAdjacentHTML("beforeend", renderBottomNav());
  attachEvents();
}

// The sidebar (month nav / balance card / sub-tabs) only makes sense for
// Overview, which is month-scoped. Goals, Utang, and Profile aren't, so they
// get their own sidebar content (or none) instead of the Net Balance card.
function renderSideContent(t) {
  if (state.section === "goals") return "";
  if (state.section === "loans") return renderUtangLedgerCard();
  if (state.section === "profile") return "";
  return `
    ${renderMonthNav()}
    ${renderLedgerCard(t)}
    ${renderTabs()}
  `;
}

// Overview owns the existing sub-tabs (Overview/Income/Expenses/Budgets/Bills).
// Goals, Utang, and Profile are full screens with no sub-tabs of their own.
function renderSectionContent(t) {
  if (state.section === "goals") return renderGoalsTab();
  if (state.section === "loans") return renderLoansTab();
  if (state.section === "profile") return renderProfileTab();
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

// Keeps the realtime subscription pointed at whichever household is
// currently active — call this any time that could have changed.
function refreshRealtimeSubscription() {
  const id = getActiveHouseholdId();
  if (id) subscribeToHousehold(id, onHouseholdChanged);
  else unsubscribeRealtime();
}

// Called after creating/joining/leaving a household — the data scope itself
// changed, so this re-loads from the cloud (not just a re-render). Also used
// as the realtime callback: another household member's change fires this
// same reload, debounced, from src/realtime.js.
async function onHouseholdChanged() {
  await switchToCloudData();
  goToMonth();
  refreshRealtimeSubscription();
}

function attachEvents() {
  const prevMonthBtn = document.getElementById("prevMonth");
  const nextMonthBtn = document.getElementById("nextMonth");
  if (prevMonthBtn)
    prevMonthBtn.onclick = () => {
      shiftMonth(-1);
      goToMonth();
    };
  if (nextMonthBtn)
    nextMonthBtn.onclick = () => {
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

  const fabBtn = document.getElementById("fabBtn");
  if (fabBtn) {
    fabBtn.onclick = () => {
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
  }

  // The account icon in the header now just jumps to the Profile tab.
  document.getElementById("accountBtn").onclick = () => {
    state.section = "profile";
    render();
  };

  const householdBadge = document.getElementById("householdBadge");
  if (householdBadge) householdBadge.onclick = openHouseholdSheet;

  attachIncomeEvents();
  attachBudgetEvents();
  attachExpenseEvents();
  attachProfileEvents();

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
  initProfileTab(render); // theme toggle inside Profile needs to trigger a re-render too
  initDeleteAccountSheet(() => {
    state.section = "overview";
    render();
  });

  const loadingEl = document.getElementById("app");
  loadingEl.innerHTML = `<div style="padding:60px 10px;text-align:center;color:var(--muted);font-family:Inter,sans-serif;font-size:13px;">Opening the ledger…</div>`;

  await initAuth();
  await loadActiveHousehold(); // must resolve before the first data load, since it decides what scope to load
  refreshRealtimeSubscription();

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
      unsubscribeRealtime(); // signed out — nothing to subscribe to anymore
    }
    refreshRealtimeSubscription();
    goToMonth();
    if (user && consumePendingPasswordSetup()) {
      openSetPasswordSheet({ context: "auto" });
    }
  });

  await initData();
  goToMonth();

  // Catches the case where THIS page load IS the magic-link landing itself.
  // By the time initAuth() resolved above, the session may already reflect
  // the new sign-in — meaning lastUserId was initialized from that same
  // already-established session, so the SIGNED_IN transition inside
  // onAuthChange never actually fires (no change to detect). Checking the
  // flag here too, unconditionally, closes that gap. Safe to call even when
  // there's nothing pending — it's a no-op in that case.
  if (getCurrentUser() && consumePendingPasswordSetup()) {
    openSetPasswordSheet({ context: "auto" });
  }
})();
