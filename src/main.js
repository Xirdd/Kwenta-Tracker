import "./style.css";
import { initSyncQueue } from "./syncQueue.js";

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
import { renderFab, attachFabEvents } from "./components/fabMenu.js";
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
import { attachQuickAddEvents } from "./components/quickAddBar.js";
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
import { requireMfaIfNeeded } from "./components/mfaChallengeSheet.js";
import { needsMfaChallenge } from "./mfa.js";
import { initMfaSetupSheet } from "./components/mfaSetupSheet.js";

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
  app.insertAdjacentHTML("beforeend", renderFab(state.section, state.tab));
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
// Goals, Utang, and Profile are full screens with no sub-tabs.
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

  // The FAB is a single, non-expanding + button. Which action it triggers
  // depends entirely on the active tab/section (see fabMenu.js) — it isn't
  // rendered at all on Overview or Budgets.
  attachFabEvents(state.section, state.tab, {
    onExpense: () => openForm("expense", null),
    onIncome: () => openForm("income", null),
    onBill: () => openBillForm(null),
    onGoal: () => openGoalForm(null),
    onLoan: () => openLoanForm(null),
  });

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
  attachQuickAddEvents();

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

// Fades out and removes the branded splash screen (markup lives in
// index.html so it's visible instantly on first paint, before this bundle
// even finishes loading). Called once, right after the first real render —
// see the end of init() below — so there's no gap between "splash gone" and
// "actual app visible".
function hideSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;
  splash.classList.add("hide");
  setTimeout(() => splash.remove(), 450); // matches the CSS fade duration
}

(async function init() {
  // Safety net: hideSplash() is idempotent (no-ops if already removed), so
  // this just guarantees the splash can't get stuck forever if something
  // in the auth/data chain below throws before reaching the normal call.
  setTimeout(hideSplash, 6000);

  initSyncQueue(); // retries any cloud writes that failed in a previous offline session

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
  initMfaSetupSheet(render);

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
      // Waits for any required 2FA challenge to complete BEFORE fetching
      // cloud data. With aal2-enforced RLS, fetching any earlier — while
      // still at aal1 — would silently return zero rows (RLS just filters
      // them out, it doesn't error), and the app would render as if the
      // account were empty. If no challenge is needed (the common case,
      // no 2FA enabled), this callback fires immediately, so there's no
      // added delay for most sign-ins.
      await requireMfaIfNeeded(async () => {
        await switchToCloudData();
        refreshRealtimeSubscription();
        goToMonth();
      });
      if (consumePendingPasswordSetup()) {
        openSetPasswordSheet({ context: "auto" });
      }
    } else {
      switchToLocalData();
      unsubscribeRealtime(); // signed out — nothing to subscribe to anymore
      refreshRealtimeSubscription();
      goToMonth();
    }
  });

  // Signed-out page loads (or ones where MFA isn't relevant) still need
  // their initial data loaded — the branch above only covers the
  // *signed-in* path, since only that one can hit the aal2 gate.
  await initData();
  goToMonth();
  hideSplash(); // first real content is on screen now — safe to reveal it

  // Catches the case where THIS page load IS the magic-link landing itself,
  // or a returning session that's still short of aal2. By the time
  // initAuth() resolved above, the session may already reflect the new
  // sign-in — meaning lastUserId was initialized from that same
  // already-established session, so the SIGNED_IN transition inside
  // onAuthChange never actually fires (no change to detect).
  //
  // Checking needsMfaChallenge() directly first, rather than always calling
  // requireMfaIfNeeded() and re-fetching inside its callback regardless: for
  // the common case — no 2FA enabled, or a returning session already at
  // aal2 — initData() above already fetched correctly, so re-fetching again
  // here would just double the cloud calls on every normal app open. Only
  // when a challenge is genuinely outstanding does this re-fetch after it
  // completes, since that's the one case initData()'s earlier fetch would
  // have returned empty (RLS filtering at aal1).
  if (getCurrentUser()) {
    const stillNeedsChallenge = await needsMfaChallenge().catch(() => false);
    if (stillNeedsChallenge) {
      await requireMfaIfNeeded(async () => {
        await switchToCloudData();
        goToMonth();
      });
    }
    if (consumePendingPasswordSetup()) {
      openSetPasswordSheet({ context: "auto" });
    }
  }
})();
