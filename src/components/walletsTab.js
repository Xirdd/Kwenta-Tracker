import { DATA } from "../state.js";
import { getActiveHousehold } from "../household.js";
import { fmt, escapeHtml, formatDate } from "../format.js";
import { categoryIconBadge } from "../categories.js";
import { iconPaths } from "../icons/categoryIcons.js";
import {
  walletBalance,
  totalWalletBalance,
  providerInfo,
  getWallet,
  recentTransfers,
  removeTransfer,
} from "../wallets.js";
import { openTransferForm } from "./transferSheet.js";

const SWAP_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`;

let onChange = () => {};
export function initWalletsTab(rerenderCallback) {
  onChange = rerenderCallback;
}

// Reuses .loan-card / .loan-badge / .goal-amounts / .goal-stack /
// .budget-summary / .budget-toolbar / .budget-customize-btn / .list / .row /
// .btn-undo — the same look loansTab.js, goalSheet.js and budgets.js already
// use, so this tab needed no CSS of its own.
export function renderWalletsTab() {
  const wallets = DATA.wallets;

  if (wallets.length === 0) {
    return `
    <div class="section-title">Wallets <span class="sub">GCash, banks, cash on hand</span></div>
    <div class="empty-state">
      <div class="glyph">₱</div>
      <p>No wallets yet.<br/>Tap + to add GCash, Maya, GoTyme, Maribank, or any other wallet you use.</p>
    </div>`;
  }

  const total = totalWalletBalance();
  const inHousehold = !!getActiveHousehold();

  const cards = wallets
    .map((w) => {
      const info = providerInfo(w.provider);
      const balance = walletBalance(w);
      const negative = balance < 0;
      return `
    <div class="loan-card" data-wallet="${w.id}" style="--loan-accent:${info.color};">
      <div class="loan-glow"></div>
      <div class="loan-top">
        <div class="loan-person-row">
          ${categoryIconBadge({ color: info.color, icon: iconPaths(info.icon) }, 32)}
          <div class="loan-person">${escapeHtml(w.name)}</div>
        </div>
        <span class="loan-badge" style="background:${info.color}26;color:${info.color};">${escapeHtml(info.label)}${inHousehold && w.shared === false ? " · Private" : ""}</span>
      </div>
      <div class="goal-amounts">
        <span class="goal-saved" style="${negative ? "color:var(--coral);" : ""}">${negative ? "-" : ""}${fmt(Math.abs(balance))}</span>
      </div>
    </div>`;
    })
    .join("");

  return `
  <div class="section-title">Wallets <span class="sub">${wallets.length} tracked</span></div>
  <div class="budget-toolbar">
    <span class="budget-toolbar-count">Total across wallets: <strong>${fmt(total)}</strong></span>
    ${
      wallets.length >= 2
        ? `<button type="button" class="budget-customize-btn" id="walletTransferBtn">${SWAP_ICON}Transfer</button>`
        : ""
    }
  </div>
  <div class="goal-stack">${cards}</div>
  ${renderRecentTransfers()}
  `;
}

function renderRecentTransfers() {
  const transfers = recentTransfers(6);
  if (transfers.length === 0) return "";

  const rows = transfers
    .map((t) => {
      const from = getWallet(t.fromWalletId);
      const to = getWallet(t.toWalletId);
      return `
    <div class="row">
      <div class="info">
        <div class="desc">${escapeHtml(from?.name || "Unknown wallet")} → ${escapeHtml(to?.name || "Unknown wallet")}</div>
        <div class="meta">${formatDate(t.date)} · ${fmt(t.amount)}</div>
      </div>
      <button class="btn-undo" data-undo-transfer="${t.transferId}" title="Undo this transfer">Undo</button>
    </div>`;
    })
    .join("");

  return `
  <div class="section-title" style="margin:20px 2px 8px 2px;font-size:14px;">Recent transfers</div>
  <div class="list">${rows}</div>`;
}

export function attachWalletsEvents() {
  const transferBtn = document.getElementById("walletTransferBtn");
  if (transferBtn) transferBtn.onclick = openTransferForm;

  document.querySelectorAll("[data-undo-transfer]").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      removeTransfer(btn.dataset.undoTransfer);
      onChange();
    };
  });
}
