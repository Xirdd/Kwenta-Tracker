import { DATA, monthTx, saveData } from "../state.js";
import { CATEGORIES, catInfo, categoryIconBadge } from "../categories.js";
import { fmt } from "../format.js";
import { isCloudMode, cloudUpsertBudget } from "../sync.js";
import { notifySyncError } from "../toast.js";

const CHEVRON_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

export function renderBudgets() {
  const exp = monthTx("expense");
  const spentByCat = {};
  exp.forEach((e) => {
    spentByCat[e.category] =
      (spentByCat[e.category] || 0) + Number(e.amount || 0);
  });
  const totalBudget = CATEGORIES.reduce(
    (s, c) => s + (Number(DATA.budgets[c.id]) || 0),
    0,
  );
  const totalSpent = exp.reduce((s, e) => s + Number(e.amount || 0), 0);

  return `
  <div class="section-title">Budgets <span class="sub">applies every month</span></div>
  ${
    totalBudget > 0
      ? `
    <div class="budget-summary">
      <span>Total budgeted</span>
      <span>${fmt(totalSpent)} <span class="of">of ${fmt(totalBudget)}</span></span>
    </div>`
      : ""
  }
  <div class="list budget-list">
    ${CATEGORIES.map((c) => {
      const budget = Number(DATA.budgets[c.id]) || 0;
      const spent = spentByCat[c.id] || 0;
      const pct = budget ? Math.min(100, (spent / budget) * 100) : 0;
      const over = budget > 0 && spent > budget;
      return `
      <div class="budget-row" data-cat-row="${c.id}">
        <div class="budget-header" data-toggle="${c.id}">
          <div class="budget-name">${categoryIconBadge(c, 32)}${c.label}</div>
          <span class="budget-chevron">${CHEVRON_ICON}</span>
        </div>
        <div class="budget-detail">
          <div class="budget-detail-inner">
            <div class="budget-input-wrap">
              <span>₱</span>
              <input type="number" inputmode="decimal" class="budgetInput" data-cat="${c.id}" placeholder="0" value="${budget || ""}"/>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${budget ? Math.max(pct, 2) : 0}%;background:${over ? "var(--coral)" : c.color}"></div></div>
            <div class="budget-meta ${over ? "over" : ""}">${fmt(spent)} of ${budget ? fmt(budget) : "no limit set"}${over ? " · over budget" : ""}</div>
          </div>
        </div>
      </div>`;
    }).join("")}
  </div>
  `;
}

// Live-updates a budget row's progress bar without a full re-render (keeps
// input focus). Also wires the tap-to-reveal toggle on each row's header.
export function attachBudgetEvents() {
  document.querySelectorAll(".budgetInput").forEach((inp) => {
    inp.oninput = (e) => {
      const cat = inp.dataset.cat;
      DATA.budgets[cat] =
        e.target.value === "" ? undefined : Number(e.target.value);
      saveData();
      if (isCloudMode())
        cloudUpsertBudget(cat, DATA.budgets[cat]).catch((err) =>
          notifySyncError(err),
        );
      const spent = monthTx("expense")
        .filter((x) => x.category === cat)
        .reduce((s, x) => s + Number(x.amount || 0), 0);
      const budget = Number(DATA.budgets[cat]) || 0;
      const pct = budget ? Math.min(100, (spent / budget) * 100) : 0;
      const over = budget > 0 && spent > budget;
      const row = inp.closest(".budget-row");
      const fill = row.querySelector(".bar-fill");
      fill.style.width = (budget ? Math.max(pct, 2) : 0) + "%";
      fill.style.background = over ? "var(--coral)" : catInfo(cat).color;
      const meta = row.querySelector(".budget-meta");
      meta.textContent = `${fmt(spent)} of ${budget ? fmt(budget) : "no limit set"}${over ? " · over budget" : ""}`;
      meta.classList.toggle("over", over);
    };
    // Typing shouldn't collapse the row it's inside — only the header toggles it.
    inp.onclick = (e) => e.stopPropagation();
  });

  document.querySelectorAll("[data-toggle]").forEach((header) => {
    header.onclick = () => {
      const row = header.closest(".budget-row");
      row.classList.toggle("open");
    };
  });
}
