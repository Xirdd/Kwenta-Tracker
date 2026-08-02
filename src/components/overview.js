import {
  state,
  DATA,
  monthTx,
  monthLabel,
  monthsBack,
  trendTotals,
} from "../state.js";
import { catInfo } from "../categories.js";
import { fmt } from "../format.js";

export function renderOverview() {
  const exp = monthTx("expense");
  const byCat = {};
  exp.forEach((e) => {
    byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0);
  });
  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const max = entries.length ? entries[0][1] : 0;
  const totalExp = entries.reduce((s, [, v]) => s + v, 0);

  return `
  <div class="section-title">Where it went <span class="sub">expenses by category</span></div>
  ${
    entries.length === 0
      ? `
    <div class="empty-state">
      <div class="glyph">₱</div>
      <p>No expenses logged for ${monthLabel(state.monthKey)} yet.<br/>Tap + to add your first entry.</p>
    </div>`
      : `
    <div class="bars">
      <div class="donut-wrap">
        ${renderDonut(entries, totalExp)}
        <div class="donut-center">
          <div class="donut-total">${fmt(totalExp)}</div>
          <div class="donut-label">total spent</div>
        </div>
      </div>
      ${entries
        .map(([catId, amt]) => {
          const c = catInfo(catId);
          const pct = max ? Math.max(6, (amt / max) * 100) : 0;
          const budget = Number(DATA.budgets[catId]) || 0;
          const over = budget > 0 && amt > budget;
          return `
        <div class="bar-row">
          <div class="top"><span>${c.label}${over ? ' <span class="over-flag">over budget</span>' : ""}</span><span>${fmt(amt)}</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${over ? "var(--coral)" : c.color}"></div></div>
        </div>`;
        })
        .join("")}
    </div>`
  }

  ${renderTrend()}
  `;
}

function renderDonut(entries, total) {
  const r = 58,
    cx = 85,
    cy = 85,
    circ = 2 * Math.PI * r;
  let acc = 0;
  const arcs = entries
    .map(([catId, amt]) => {
      const c = catInfo(catId);
      const frac = total ? amt / total : 0;
      const dash = frac * circ;
      const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c.color}" stroke-width="17" stroke-dasharray="${dash.toFixed(2)} ${(circ - dash).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
      acc += dash;
      return seg;
    })
    .join("");
  return `<svg viewBox="0 0 170 170" width="170" height="170" class="donut-svg">${arcs}</svg>`;
}

function renderTrend() {
  const months = monthsBack(6);
  const data = months.map((mk) => ({ mk, ...trendTotals(mk) }));
  const max = Math.max(1, ...data.map((d) => Math.max(d.inc, d.exp)));
  return `
  <div class="section-title">6-month trend <span class="sub">income vs expenses</span></div>
  <div class="bars">
    <div class="trend-legend">
      <span><i style="background:var(--green)"></i>Income</span>
      <span><i style="background:var(--coral)"></i>Expenses</span>
    </div>
    <div class="trend-chart">
      ${data
        .map((d) => {
          const [y, m] = d.mk.split("-").map(Number);
          const label = new Date(y, m - 1, 1).toLocaleDateString("en-US", {
            month: "short",
          });
          const incH = Math.max(3, Math.round((d.inc / max) * 72));
          const expH = Math.max(3, Math.round((d.exp / max) * 72));
          return `
        <div class="trend-col">
          <div class="trend-bars">
            <div class="trend-bar income" style="height:${incH}px"></div>
            <div class="trend-bar expense" style="height:${expH}px"></div>
          </div>
          <div class="trend-label">${label}</div>
        </div>`;
        })
        .join("")}
    </div>
  </div>`;
}
