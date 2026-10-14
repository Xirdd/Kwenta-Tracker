import { escapeHtml, fmt, formatDate } from "../format.js";
import { openModal, closeModal } from "./modal.js";
import { flashField } from "../dom.js";
import { categoryIconBadge } from "../categories.js";
import { iconPaths } from "../icons/categoryIcons.js";
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

  const providerGrid = () =>
    WALLET_PROVIDERS.map(
      (p) => `
    <div class="cat-opt ${p.id === chosenProvider ? "selected" : ""}" data-provider="${p.id}">
      ${categoryIconBadge({ color: p.color, icon: iconPaths("card") }, 28)}${escapeHtml(p.label)}
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
    const payload = { name, provider: chosenProvider, startingBalance };
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

export function openWalletDetail(wallet) {
  const info = providerInfo(wallet.provider);
  const balance = walletBalance(wallet);
  const recent = transactionsForWallet(wallet.id).slice(0, 8);

  openModal(`
    <div class="grabber"></div>
    <h3>${escapeHtml(wallet.name)}</h3>
    <p class="auth-message">${escapeHtml(info.label)}</p>
    <div class="goal-amounts" style="margin-bottom:14px;">
      <span class="goal-saved" style="${balance < 0 ? "color:var(--coral);" : ""}">${balance < 0 ? "-" : ""}${fmt(Math.abs(balance))}</span>
      <span class="goal-of">current balance</span>
    </div>
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="wEditBtn">Edit wallet</button>
    </div>
    ${
      recent.length > 0
        ? `
    <div class="section-title" style="margin:20px 2px 8px 2px;font-size:14px;">Recent activity</div>
    <div class="list">
      ${recent
        .map(
          (tx) => `
        <div class="row">
          <div class="info">
            <div class="desc">${escapeHtml(tx.desc || "")}</div>
            <div class="meta">${formatDate(tx.date)}</div>
          </div>
          <div class="amt ${tx.type === "expense" ? "expense" : "income"}">${tx.type === "expense" ? "-" : "+"}${fmt(tx.amount)}</div>
        </div>
      `,
        )
        .join("")}
    </div>`
        : `<p class="field-hint" style="margin-top:14px;">No transactions assigned to this wallet yet — pick it from the Wallet field when logging an expense or income.</p>`
    }
  `);

  document.getElementById("wEditBtn").onclick = () => openWalletForm(wallet);
}
