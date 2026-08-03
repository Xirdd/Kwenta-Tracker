import {
  state,
  DATA,
  monthTx,
  monthLabel,
  totals,
  saveData,
} from "../state.js";
import { incCatInfo } from "../categories.js";
import { fmt, formatDate, escapeHtml } from "../format.js";
import { isCloudMode, cloudUpsertSalary } from "../sync.js";

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
          <span class="chip" style="background:${c.color}"></span>
          <div class="info">
            <div class="desc">${escapeHtml(tx.desc || c.label)}</div>
            <div class="meta">${c.label} · ${formatDate(tx.date)}</div>
          </div>
          <div class="amt income">+${fmt(tx.amount)}</div>
        </div>`;
        })
        .join("")}
    </div>`
  }
  `;
}

// Live-updates the salary field and the balance card without a full re-render (keeps input focus)
export function attachIncomeEvents() {
  const salaryInput = document.getElementById("salaryInput");
  if (!salaryInput) return;
  salaryInput.oninput = (e) => {
    DATA.salary[state.monthKey] =
      e.target.value === "" ? undefined : Number(e.target.value);
    saveData();
    if (isCloudMode())
      cloudUpsertSalary(state.monthKey, DATA.salary[state.monthKey]).catch(
        (err) => console.error("Cloud sync failed", err),
      );
    const t = totals();
    document.querySelector(".balance-amount").textContent =
      (t.balance < 0 ? "-" : "") + fmt(Math.abs(t.balance));
    document.querySelectorAll(".mini-stat .amt")[0].textContent = fmt(
      t.totalIncome,
    );
    document.querySelectorAll(".mini-stat .amt")[1].textContent = fmt(
      t.totalExpense,
    );
  };
}
