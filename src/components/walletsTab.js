import { DATA } from "../state.js";
import { fmt, escapeHtml } from "../format.js";
import { categoryIconBadge } from "../categories.js";
import { iconPaths } from "../icons/categoryIcons.js";
import { walletBalance, totalWalletBalance, providerInfo } from "../wallets.js";

// Reuses .loan-card / .loan-badge / .goal-amounts / .goal-stack /
// .budget-summary — the same look loansTab.js and budgets.js already use —
// so this tab needed no CSS of its own.
export function renderWalletsTab() {
  const wallets = DATA.wallets;

  if (wallets.length === 0) {
    return `
    <div class="section-title">Wallets <span class="sub">GCash, banks, cash on hand</span></div>
    <div class="empty-state">
      <div class="glyph">₱</div>
      <p>No wallets yet.<br/>Tap + to add GCash, GoTyme, Maribank, or any other wallet you use.</p>
    </div>`;
  }

  const total = totalWalletBalance();

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
          ${categoryIconBadge({ color: info.color, icon: iconPaths("card") }, 32)}
          <div class="loan-person">${escapeHtml(w.name)}</div>
        </div>
        <span class="loan-badge" style="background:${info.color}26;color:${info.color};">${escapeHtml(info.label)}</span>
      </div>
      <div class="goal-amounts">
        <span class="goal-saved" style="${negative ? "color:var(--coral);" : ""}">${negative ? "-" : ""}${fmt(Math.abs(balance))}</span>
      </div>
    </div>`;
    })
    .join("");

  return `
  <div class="section-title">Wallets <span class="sub">${wallets.length} tracked</span></div>
  <div class="budget-summary" style="margin-bottom:16px;">
    <span>Total across wallets</span>
    <span>${fmt(total)}</span>
  </div>
  <div class="goal-stack">${cards}</div>
  `;
}
