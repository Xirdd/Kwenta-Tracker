import {
  state,
  DATA,
  monthTx,
  monthLabel,
  monthsBack,
  trendTotals,
} from "../state.js";
import { catInfo } from "../categories.js";
import { fmt, escapeHtml } from "../format.js";
import {
  upcomingBills,
  ordinalSuffix,
  currentRealMonthKey,
  billCategoryLabel,
} from "../bills.js";
import { renderInsightsCard } from "../insights.js";

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
  ${renderUpcomingBills()}
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

  ${renderInsightsCard()}
  ${renderTrend()}
  `;
}

function renderUpcomingBills() {
  const items = upcomingBills();
  if (items.length === 0) return "";
  const monthKey = currentRealMonthKey();

  return `
  <div class="section-title">Upcoming bills <span class="sub">due soon</span></div>
  <div class="list" style="margin-bottom:8px;">
    ${items
      .map(({ bill, daysLeft }) => {
        const c = catInfo(bill.category);
        const badge =
          daysLeft < 0
            ? `${Math.abs(daysLeft)}d overdue`
            : daysLeft === 0
              ? "Due today"
              : `Due in ${daysLeft}d`;
        const badgeClass =
          daysLeft <= 0 ? "overdue" : daysLeft <= 3 ? "soon" : "later";
        return `
      <div class="bill-row" data-bill="${bill.id}" data-month="${monthKey}">
        <span class="chip" style="background:${c.color}"></span>
        <div class="info">
          <div class="desc">${escapeHtml(bill.name)}</div>
          <div class="meta">${escapeHtml(billCategoryLabel(bill, c.label))} · due on the ${bill.dueDay}${ordinalSuffix(bill.dueDay)}</div>
        </div>
        <div class="bill-right">
          <span class="bill-badge ${badgeClass}">${badge}</span>
        </div>
      </div>`;
      })
      .join("")}
  </div>`;
}

// Gradient-filled, round-capped donut segments instead of flat color wedges
// — reads softer and matches the rounded-card aesthetic elsewhere.
function renderDonut(entries, total) {
  const r = 60,
    cx = 90,
    cy = 90,
    circ = 2 * Math.PI * r;
  let acc = 0;
  const defs = entries
    .map(([catId], i) => {
      const c = catInfo(catId);
      return `<linearGradient id="donutGrad${i}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c.color}"/>
        <stop offset="100%" stop-color="${c.color}" stop-opacity="0.65"/>
      </linearGradient>`;
    })
    .join("");
  const arcs = entries
    .map(([catId, amt], i) => {
      const frac = total ? amt / total : 0;
      // A tiny gap between segments so gradients read as distinct slices
      // rather than one continuous ring.
      const gap = entries.length > 1 ? Math.min(circ * 0.008, 3) : 0;
      const dash = Math.max(frac * circ - gap, 0);
      const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#donutGrad${i})" stroke-width="18" stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${(circ - dash).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
      acc += frac * circ;
      return seg;
    })
    .join("");
  return `<svg viewBox="0 0 180 180" width="180" height="180" class="donut-svg"><defs>${defs}</defs>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--paper-2)" stroke-width="18"/>
    ${arcs}
  </svg>`;
}

// Converts a set of points into a smooth Catmull-Rom-to-Bezier path, so the
// trend reads as a fluid curve rather than jagged bar-to-bar jumps.
function smoothPath(points) {
  if (points.length < 2) return "";
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function renderTrend() {
  const months = monthsBack(6);
  const data = months.map((mk) => ({ mk, ...trendTotals(mk) }));
  const max = Math.max(1, ...data.map((d) => Math.max(d.inc, d.exp)));

  const W = 300,
    H = 130,
    PAD = 10;
  const stepX = data.length > 1 ? (W - PAD * 2) / (data.length - 1) : 0;
  const yFor = (v) => H - PAD - (v / max) * (H - PAD * 2);

  const incPoints = data.map((d, i) => ({
    x: PAD + i * stepX,
    y: yFor(d.inc),
  }));
  const expPoints = data.map((d, i) => ({
    x: PAD + i * stepX,
    y: yFor(d.exp),
  }));

  const incLine = smoothPath(incPoints);
  const expLine = smoothPath(expPoints);
  const incArea = `${incLine} L ${incPoints[incPoints.length - 1].x.toFixed(1)},${H} L ${incPoints[0].x.toFixed(1)},${H} Z`;
  const expArea = `${expLine} L ${expPoints[expPoints.length - 1].x.toFixed(1)},${H} L ${expPoints[0].x.toFixed(1)},${H} Z`;

  const dots = (points, color) =>
    points
      .map(
        (p) =>
          `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${color}" stroke="var(--paper)" stroke-width="1.5"/>`,
      )
      .join("");

  return `
  <div class="section-title">6-month trend <span class="sub">income vs expenses</span></div>
  <div class="bars">
    <div class="trend-legend">
      <span><i style="background:var(--green)"></i>Income</span>
      <span><i style="background:var(--coral)"></i>Expenses</span>
    </div>
    <div class="trend-area-wrap">
      <svg viewBox="0 0 ${W} ${H}" class="trend-area-svg">
        <defs>
          <linearGradient id="incGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="var(--green)" stop-opacity="0.32"/>
            <stop offset="100%" stop-color="var(--green)" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="expGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="var(--coral)" stop-opacity="0.28"/>
            <stop offset="100%" stop-color="var(--coral)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${incArea}" fill="url(#incGrad)"/>
        <path d="${expArea}" fill="url(#expGrad)"/>
        <path d="${incLine}" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round"/>
        <path d="${expLine}" fill="none" stroke="var(--coral)" stroke-width="2.5" stroke-linecap="round"/>
        ${dots(incPoints, "var(--green)")}
        ${dots(expPoints, "var(--coral)")}
      </svg>
    </div>
    <div class="trend-x-labels">
      ${data
        .map((d) => {
          const [y, m] = d.mk.split("-").map(Number);
          const label = new Date(y, m - 1, 1).toLocaleDateString("en-US", {
            month: "short",
          });
          return `<span>${label}</span>`;
        })
        .join("")}
    </div>
  </div>`;
}
