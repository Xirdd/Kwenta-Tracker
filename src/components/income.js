import {
  state,
  DATA,
  monthTx,
  monthLabel,
  totals,
  saveData,
} from "../state.js";
import { incCatInfo, categoryIconBadge } from "../categories.js";
import { fmt, formatDate, escapeHtml } from "../format.js";
import { isCloudMode, cloudUpsertSalary } from "../sync.js";
import { notifySyncError } from "../toast.js";

export function renderIncome() {
  const extras = monthTx("income").sort((a, b) =>
    (b.date || "").localeCompare(a.date || ""),
  );
  return `
  <div class="section-title">Monthly salary</div>
  <div class="salary-card">
    <label for="salaryInput">Take-home pay for ${monthLabel(state.monthKey)}</label>
    <div class="salary-input-wrap">
      <span class="sym">₱</span>
      <input id="salaryInput" type="number" inputmode="decimal" placeholder="0.00" value="${DATA.salary[state.monthKey] ?? ""}"/>
    </div>
    <p class="salary-note">Saved automatically. Add bonuses or side income below.</p>
  </div>

  <div class="section-title">Other income <span class="sub">${extras.length} ${extras.length === 1 ? "entry" : "entries"}</span></div>
  ${
    extras.length === 0
      ? `
    <div class="empty-state">
      <div class="glyph">＋</div>
      <p>No extra income yet — bonuses, freelance,<br/>or allowance can go here.</p>
    </div>`
      : `
    <div class="list">
      ${extras
        .map((tx) => {
          const c = incCatInfo(tx.category);
          return `
        <div class="row" data-edit="${tx.id}" data-type="income">
          ${categoryIconBadge(c, 36)}
          <div class="info">
            <div class="desc">${escapeHtml(tx.desc || c.label)}${tx.recurringId ? ' <span class="recur-badge" title="Repeats monthly">↻</span>' : ""}</div>
            <div class="meta">${c.label} · ${formatDate(tx.date)}</div>
            ${tx.tags && tx.tags.length ? `<div class="tag-pills">${tx.tags.map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
          </div>
          <div class="amt income">+${fmt(tx.amount)}</div>
        </div>`;
        })
        .join("")}
    </div>`
  }
  `;
}

// Live-updates the salary field and the balance hero without a full re-render
// (keeps input focus). Selectors here match the borderless hero markup in
// ledgerCard.js (.hero-stat-inline .amt) — .balance-amount itself kept its
// name across that redesign, but .mini-stat was renamed to .hero-stat-inline,
// so this had to be updated to match or it would silently stop updating.
export function attachIncomeEvents() {
  const salaryInput = document.getElementById("salaryInput");
  if (!salaryInput) return;
  salaryInput.oninput = (e) => {
    DATA.salary[state.monthKey] =
      e.target.value === "" ? undefined : Number(e.target.value);
    saveData();
    if (isCloudMode())
      cloudUpsertSalary(state.monthKey, DATA.salary[state.monthKey]).catch(
        (err) => notifySyncError(err),
      );
    const t = totals();
    document.querySelector(".balance-amount").textContent =
      (t.balance < 0 ? "-" : "") + fmt(Math.abs(t.balance));
    document.querySelectorAll(".hero-stat-inline .amt")[0].textContent = fmt(
      t.totalIncome,
    );
    document.querySelectorAll(".hero-stat-inline .amt")[1].textContent = fmt(
      t.totalExpense,
    );
  };
}
