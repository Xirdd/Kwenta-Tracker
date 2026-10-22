import { escapeHtml, fmt, formatDate } from "../format.js";
import { openModal, closeModal } from "./modal.js";
import { flashField } from "../dom.js";
import { getActiveHousehold } from "../household.js";
import { getCurrentUser } from "../auth.js";
import { state, periodRange, monthLabel } from "../state.js";
import { addPesos } from "../money.js";
import { walletBadge } from "../walletLogos.js";
import {
  WALLET_PROVIDERS,
  providerInfo,
  createWallet,
  updateWallet,
  deleteWallet,
  walletBalance,
  transactionsForWallet,
} from "../wallets.js";

let onChange = () => {};

export function initWalletSheets(rerenderCallback) {
  onChange = rerenderCallback;
}

export function openWalletForm(wallet) {
  const heading = wallet ? "Edit wallet" : "Add a wallet";
  let chosenProvider = wallet ? wallet.provider : "gcash";

  // The share switch only appears inside a household, and only for the wallet's
  // owner: someone else's shared wallet can't be turned private by a member
  // (the database wouldn't allow it either).
  const household = getActiveHousehold();
  const me = getCurrentUser();
  const isOwner = !wallet || !wallet.userId || (me && wallet.userId === me.id);
  const canChooseSharing = !!household && isOwner;
  const sharedNow = wallet ? wallet.shared !== false : true;

  const providerGrid = () =>
    WALLET_PROVIDERS.map(
      (p) => `
    <div class="cat-opt ${p.id === chosenProvider ? "selected" : ""}" data-provider="${p.id}">
      ${walletBadge(p, 28)}${escapeHtml(p.label)}
    </div>`,
    ).join("");

  openModal(`
    <div class="grabber"></div>
    <h3>${heading}</h3>
    <div class="field">
      <label>Name</label>
      <input id="wName" type="text" placeholder="e.g. My GCash, Payroll account" value="${escapeHtml(wallet?.name || "")}"/>
    </div>
    <div class="field">
      <label>Type</label>
      <div class="cat-grid" id="wProviderGrid">${providerGrid()}</div>
    </div>
    <div class="field amount">
      <label>Starting balance <span class="opt">(what's already in it today)</span></label>
      <input id="wStarting" type="number" inputmode="decimal" placeholder="0.00" value="${wallet?.startingBalance ?? ""}"/>
      <p class="field-hint">${
        wallet
          ? "Changing this shifts the running balance — it doesn't touch any transactions."
          : "Kwenta tracks the balance from here using whatever income or expenses you assign to this wallet afterward."
      }</p>
    </div>
    ${
      canChooseSharing
        ? `
    <div class="field">
      <label class="checkbox-row">
        <input type="checkbox" id="wShared" ${sharedNow ? "checked" : ""}/>
        <span>Share with ${escapeHtml(household.name)}</span>
      </label>
      <p class="field-hint">${
        sharedNow
          ? "Everyone in the household can see this wallet and assign expenses to it. Turn off to keep it private to you."
          : "Only you can see this wallet. Your own entries tagged to it still show up for the household, just without the wallet name."
      }</p>
    </div>`
        : ""
    }
    <div class="sheet-actions">
      ${wallet ? `<button class="btn btn-danger" id="wDeleteBtn">Delete</button>` : ""}
      <button class="btn btn-ghost" id="wCancelBtn">Cancel</button>
      <button class="btn btn-primary" id="wSaveBtn">Save</button>
    </div>
  `);

  document.querySelectorAll("#wProviderGrid .cat-opt").forEach((el) => {
    el.onclick = () => {
      chosenProvider = el.dataset.provider;
      document
        .querySelectorAll("#wProviderGrid .cat-opt")
        .forEach((o) => o.classList.remove("selected"));
      el.classList.add("selected");
    };
  });

  document.getElementById("wCancelBtn").onclick = closeModal;

  document.getElementById("wSaveBtn").onclick = () => {
    const name = document.getElementById("wName").value.trim();
    const startingBalance = document.getElementById("wStarting").value;
    if (!name) {
      flashField("wName");
      return;
    }
    const sharedBox = document.getElementById("wShared");
    const payload = {
      name,
      provider: chosenProvider,
      startingBalance,
      shared: sharedBox ? sharedBox.checked : undefined,
    };
    if (wallet) updateWallet(wallet, payload);
    else createWallet(payload);
    closeModal();
    onChange();
  };

  if (wallet) {
    document.getElementById("wDeleteBtn").onclick = () =>
      confirmDeleteWallet(wallet);
  }
}

function confirmDeleteWallet(wallet) {
  openModal(`
    <div class="grabber"></div>
    <h3>Delete "${escapeHtml(wallet.name)}"?</h3>
    <p class="auth-message">Its past transactions stay exactly as they are — they just won't be tagged to this wallet anymore.</p>
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="wKeepBtn">Keep it</button>
      <button class="btn btn-danger" id="wConfirmDeleteBtn">Delete</button>
    </div>
  `);
  document.getElementById("wKeepBtn").onclick = () => openWalletForm(wallet);
  document.getElementById("wConfirmDeleteBtn").onclick = () => {
    deleteWallet(wallet.id);
    closeModal();
    onChange();
  };
}

const PAGE = 8;

// `all` shows the whole history instead of the latest few.
export function openWalletDetail(wallet, { all = false } = {}) {
  const info = providerInfo(wallet.provider);
  const balance = walletBalance(wallet);
  const history = transactionsForWallet(wallet.id);
  const recent = all ? history : history.slice(0, PAGE);

  // Money in / out of THIS wallet during the period on screen. Unlike the
  // Overview totals this counts everything that moved through the wallet —
  // transfers, goal contributions and utang included — because it's the
  // wallet's own movement, the same rule its balance follows.
  const { start, end } = periodRange(state.monthKey);
  let moneyIn = 0;
  let moneyOut = 0;
  history.forEach((t) => {
    if (!t.date || t.date < start || t.date > end) return;
    if (t.type === "income") moneyIn = addPesos(moneyIn, t.amount);
    else moneyOut = addPesos(moneyOut, t.amount);
  });

  openModal(`
    <div class="grabber"></div>
    <h3>${escapeHtml(wallet.name)}</h3>
    <p class="auth-message">${escapeHtml(info.label)}${getActiveHousehold() && wallet.shared === false ? " · Private (only you can see this)" : ""}</p>
    <div class="goal-amounts" style="margin-bottom:14px;">
      <span class="goal-saved" style="${balance < 0 ? "color:var(--coral);" : ""}">${balance < 0 ? "-" : ""}${fmt(Math.abs(balance))}</span>
      <span class="goal-of">current balance</span>
    </div>
    <div class="stat-strip">
      <div class="stat-chip">
        <div class="label">In · ${escapeHtml(monthLabel(state.monthKey))}</div>
        <div class="value" style="color:var(--green);">${fmt(moneyIn)}</div>
      </div>
      <div class="stat-chip">
        <div class="label">Out · ${escapeHtml(monthLabel(state.monthKey))}</div>
        <div class="value" style="color:var(--coral);">${fmt(moneyOut)}</div>
      </div>
    </div>
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="wEditBtn">Edit wallet</button>
      <button class="btn btn-ghost" id="wExpensesBtn">See expenses</button>
    </div>
    ${
      recent.length > 0
        ? `
    <div class="section-title" style="margin:20px 2px 8px 2px;font-size:14px;">${all ? "All activity" : "Recent activity"} <span class="sub">${history.length} ${history.length === 1 ? "entry" : "entries"}</span></div>
    <div class="list">
      ${recent
        .map(
          (tx) => `
        <div class="row">
          <div class="info">
            <div class="desc">${tx.transferId ? "⇄ " : ""}${escapeHtml(tx.desc || "")}</div>
            <div class="meta">${formatDate(tx.date)}</div>
          </div>
          <div class="amt ${tx.transferId ? "" : tx.type === "expense" ? "expense" : "income"}">${tx.type === "expense" ? "-" : "+"}${fmt(tx.amount)}</div>
        </div>
      `,
        )
        .join("")}
    </div>
    ${
      !all && history.length > PAGE
        ? `<button class="btn btn-ghost" id="wMoreBtn" style="width:100%;margin-top:10px;">Show all ${history.length}</button>`
        : ""
    }`
        : `<p class="field-hint" style="margin-top:14px;">No transactions assigned to this wallet yet — pick it from the Wallet field when logging an expense or income.</p>`
    }
  `);

  document.getElementById("wEditBtn").onclick = () => openWalletForm(wallet);

  // Jump to the Expenses tab, filtered to this wallet (for the period on screen).
  document.getElementById("wExpensesBtn").onclick = () => {
    state.expenseFilters = { query: "", category: null, wallet: wallet.id };
    state.section = "overview";
    state.tab = "expenses";
    closeModal();
    onChange();
  };

  const moreBtn = document.getElementById("wMoreBtn");
  if (moreBtn) moreBtn.onclick = () => openWalletDetail(wallet, { all: true });
}
