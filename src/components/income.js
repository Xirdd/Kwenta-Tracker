import {
  state,
  DATA,
  monthTx,
  monthLabel,
  totals,
  saveData,
  salaryFor,
  periodKeyHasHalf,
} from "../state.js";
import { incCatInfo, categoryIconBadge } from "../categories.js";
import { fmt, formatDate, escapeHtml, currencySymbol } from "../format.js";
import { isCloudMode, cloudUpsertSalary } from "../sync.js";
import { notifySyncError } from "../toast.js";

export function renderIncome() {
  const extras = monthTx("income").sort((a, b) =>
    (b.date || "").localeCompare(a.date || ""),
  );

  // In Monthly mode, salary entered earlier in half-month periods still
  // counts toward the month (see salaryFor in state.js). Say so, instead of
  // showing an empty box next to a non-zero total.
  const own = DATA.salary[state.monthKey];
  const derived =
    (own === undefined || own === null) && !periodKeyHasHalf(state.monthKey)
      ? salaryFor(state.monthKey)
      : 0;

  return `
  <div class="section-title">Monthly salary</div>
  <div class="salary-card">
    <label for="salaryInput">Take-home pay for ${monthLabel(state.monthKey)}</label>
    <div class="salary-input-wrap">
      <span class="sym">${escapeHtml(currencySymbol())}</span>
      <input id="salaryInput" type="number" inputmode="decimal" placeholder="0.00" value="${own ?? ""}"/>
    </div>
    <p class="salary-note">${
      derived > 0
        ? `Includes ${fmt(derived)} from your half-month entries. Type an amount here to replace it.`
        : "Saved automatically. Add bonuses or side income below."
    }</p>
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

// One pending cloud write per period key. The salary box used to write to the
// cloud on EVERY keystroke — a burst of requests that can land out of order
// (so an older number could win) and floods the offline retry queue. Budgets
// already debounce the same way (budgets.js).
const salaryTimers = {};
function scheduleSalaryWrite(key) {
  if (!isCloudMode()) return;
  clearTimeout(salaryTimers[key]);
  salaryTimers[key] = setTimeout(() => {
    cloudUpsertSalary(key, DATA.salary[key]).catch((err) =>
      notifySyncError(err),
    );
  }, 400);
}

export function attachIncomeEvents() {
  const salaryInput = document.getElementById("salaryInput");
  if (!salaryInput) return;
  salaryInput.oninput = (e) => {
    const key = state.monthKey;
    DATA.salary[key] =
      e.target.value === "" ? undefined : Number(e.target.value);
    saveData();
    scheduleSalaryWrite(key);

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
