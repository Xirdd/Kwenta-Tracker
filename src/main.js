import "./style.css";
import "./tabsShared.css";
import { initSyncQueue } from "./syncQueue.js";

import {
  state,
  DATA,
  initData,
  shiftMonth,
  totals,
  switchToCloudData,
  switchToLocalData,
  monthPortionOf,
} from "./state.js";
import { clearLocalData } from "./storage.js";
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
import {
  renderBudgets,
  attachBudgetEvents,
  initBudgetsSheet,
} from "./components/budgets.js";
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
import { closeModal } from "./components/modal.js";
import { initTheme } from "./theme.js";
import { initAppLock, resetAppLock } from "./appLock.js";
import { initAppLockSheet } from "./components/appLockSheet.js";
import { openSearchSheet, initSearchSheet } from "./components/searchSheet.js";
import { initEditProfileSheet } from "./components/editProfileSheet.js";
import {
  initShareIntakeSheet,
  openShareIntakeSheet,
} from "./components/shareIntakeSheet.js";
import { takePendingShare } from "./shareStore.js";
import {
  initAuth,
  getCurrentUser,
  onAuthChange,
  consumePendingPasswordSetup,
  endRecoveryMode,
} from "./auth.js";
import {
  isAuthorized,
  setSessionPending,
  isRecoveryActive,
  onRecoveryComplete,
} from "./authGuard.js";
import { showAuthPage, hideAuthPage } from "./components/authPage.js";
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
import { showToast } from "./toast.js";

// THE GATE. Every screen in the app is drawn by this one function, so this is
// the one place that decides whether protected content may exist at all. If
// the guard says no, #app is emptied (nothing from the ledger stays in the
// DOM, not even hidden) and the login page — or its loading view while the
// session is still being checked — is shown instead.
function render() {
  const app = document.getElementById("app");
  if (!isAuthorized()) {
    app.innerHTML = "";
    showAuthPage();
    return;
  }
  hideAuthPage();

  const t = totals();
  const user = getCurrentUser();
  const household = getActiveHousehold();
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

// Ensures this month's recurring entries exist, then renders. Recurring
// entries are only created for a signed-in, unlocked session — never behind
// the login wall.
function goToMonth() {
  if (isAuthorized()) materializeMonth(state.monthKey);
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
  if (!isAuthorized()) return;
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

  // The account icon in the header just jumps to the Profile tab.
  document.getElementById("accountBtn").onclick = () => {
    state.section = "profile";
    render();
  };

  document.getElementById("searchBtn").onclick = openSearchSheet;

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
      // data-month is always set explicitly by billsTab.js/overview.js as a
      // proper month key ("YYYY-MM") — this fallback should never actually
      // fire, but if it did, state.monthKey is a PERIOD key now
      // ("YYYY-MM-1"), so it needs converting rather than passed through raw.
      const monthKey = row.dataset.month || monthPortionOf(state.monthKey);
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
// even finishes loading). Idempotent — safe to call more than once.
function hideSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;
  splash.classList.add("hide");
  setTimeout(() => splash.remove(), 450); // matches the CSS fade duration
}

// Set when the page was opened from the phone's share sheet. The shared item
// waits in IndexedDB until someone is signed in and unlocked.
let shareWaiting = false;
let syncQueueStarted = false;

// The moment the wall comes down: loads the person's data, lifts the "pending"
// state, and lands them on the Dashboard (Overview) — never on whatever screen
// state was left over from before. `boot` is true for a page load with an
// existing session, which also picks up the on-device cache; a fresh sign-in
// reloads straight from the cloud.
async function unlockApp({ boot = false } = {}) {
  try {
    if (boot) await initData();
    else await switchToCloudData();
  } catch (e) {
    // Offline (or Supabase briefly down) with a session that's still valid:
    // fall back to the copy kept on this device rather than a blank app.
    console.error("Couldn't load from the cloud", e);
    switchToLocalData();
    showToast(
      "Couldn't reach the cloud — showing what's saved on this device.",
    );
  }

  setSessionPending(false);
  refreshRealtimeSubscription();

  // Started only once there's a session. Started earlier, a retry pass with
  // nobody signed in would mark every queued write "done" and drop it.
  if (!syncQueueStarted) {
    syncQueueStarted = true;
    initSyncQueue();
  }

  state.section = "overview";
  state.tab = "overview";
  goToMonth();
  hideSplash();

  if (shareWaiting) {
    shareWaiting = false;
    const share = await takePendingShare().catch(() => null);
    if (share) openShareIntakeSheet(share);
  }
  if (consumePendingPasswordSetup()) {
    openSetPasswordSheet({ context: "auto" });
  }
}

(async function init() {
  // "Session unknown" counts as pending from the very first line, so neither
  // the login form nor any app screen can flash before we know who this is.
  setSessionPending(true);

  // Safety net: if something below stalls (a slow network, say), show the
  // branded loading view instead of a blank screen, and never leave the
  // splash stuck forever. Both calls are idempotent.
  setTimeout(() => {
    if (!isAuthorized()) render();
    hideSplash();
  }, 6000);

  initTheme();
  initSheet(render); // let sheets trigger a re-render after save/delete
  initBillSheets(render);
  initGoalSheets(render);
  initLoanSheets(render);
  initBudgetsSheet(render); // custom budget category sheets need a re-render too
  initAppLockSheet(render);
  initSearchSheet(render);
  initEditProfileSheet(render);
  initShareIntakeSheet(render);
  initHouseholdSheet(onHouseholdChanged);
  initProfileTab(render);
  initDeleteAccountSheet(() => {
    state.section = "overview";
    render(); // the account is gone, so the guard sends them to the login page
  });
  initMfaSetupSheet(render);

  shareWaiting = new URLSearchParams(window.location.search).has("shared");
  if (shareWaiting)
    window.history.replaceState(null, "", window.location.pathname);

  await initAuth(); // reads the stored session; processes a magic-link landing too

  // The PIN / Face ID lock belongs to a signed-in session, so it starts only
  // now that we know whether there is one, and the second argument keeps it
  // from ever appearing for a signed-out visitor (including after a session
  // expires). The splash covers the app until this has had its say.
  initAppLock(
    () => {},
    () => !!getCurrentUser(),
  );

  // After a password reset: the new password is saved and the recovery session
  // is now an ordinary signed-in one, so load the data and open the Dashboard.
  onRecoveryComplete(async () => {
    setSessionPending(true);
    showAuthPage(); // loading view while the data loads
    await loadActiveHousehold();
    await unlockApp({ boot: true });
  });

  // Reacts to every later change of who is signed in (login, signup, logout,
  // an expired session). The initial session is already handled below.
  let lastUserId = getCurrentUser()?.id || null;
  onAuthChange(async (user) => {
    const userId = user?.id || null;
    if (userId === lastUserId) return; // token refreshes etc. — same person
    lastUserId = userId;

    if (!user) {
      // Signed out, or the session ended: put the wall back up and wipe
      // everything protected — open sheets, the realtime feed, and the data
      // in memory and in this device's cache (so the next person to log in
      // here can never inherit it).
      closeModal();
      unsubscribeRealtime();
      resetAppLock(); // PIN, Face ID enrollment, timers, and the lock screen itself
      setSessionPending(false);
      clearLocalData();
      switchToLocalData(); // the cache was just cleared, so this empties memory too
      await loadActiveHousehold(); // no user -> clears the active household
      state.section = "overview";
      state.tab = "overview";
      render();
      hideSplash();
      return;
    }

    // Signed in. Keep the wall up (showing the loading view) until any 2FA
    // challenge is passed and the data has loaded.
    setSessionPending(true);
    showAuthPage();
    await loadActiveHousehold();
    await requireMfaIfNeeded(() => unlockApp());
  });

  // ── Page load ──────────────────────────────────────────────────────────
  if (!getCurrentUser()) {
    // Signed out: show the login page. Any data already on this device from
    // before accounts were required is loaded into memory only (never drawn),
    // so it can be moved into the account on first sign-in.
    endRecoveryMode(); // a reset link that didn't produce a session leaves nothing to finish
    setSessionPending(false);
    await initData();
    goToMonth(); // the guard turns this into the login page
    hideSplash();
    return;
  }

  // Arrived from the link in a "reset your password" email: the person is
  // signed in with a recovery session, but must land on "Set a new password"
  // — not the app. If they use 2FA, the code is asked for first, because
  // Supabase won't change the password of an unverified 2FA session. Nothing
  // protected loads until the new password is saved (onRecoveryComplete above).
  if (isRecoveryActive()) {
    const showReset = () => {
      setSessionPending(false);
      render(); // the guard turns this into the "Set a new password" page
      hideSplash();
    };
    const needsMfa = await needsMfaChallenge().catch(() => false);
    if (needsMfa) {
      render(); // loading view behind the code prompt
      hideSplash();
      await requireMfaIfNeeded(showReset);
    } else {
      showReset();
    }
    return;
  }

  // Existing session (refresh, returning visit, or a magic-link landing).
  await loadActiveHousehold(); // decides which data scope to load
  const needsMfa = await needsMfaChallenge().catch(() => false);
  if (needsMfa) {
    // Signed in at aal1 but not past 2FA: nothing protected may show yet.
    render(); // loading view behind the code prompt
    hideSplash();
    await requireMfaIfNeeded(() => unlockApp({ boot: true }));
  } else {
    await unlockApp({ boot: true });
  }
})();
