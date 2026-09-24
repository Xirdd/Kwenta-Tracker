import "./insights.css";
import {
  DATA,
  state,
  monthTx,
  monthsBack,
  isSeparatelyTracked,
  periodRange,
  budgetFor,
} from "./state.js";
import { catInfo } from "./categories.js";
import { fmt, escapeHtml } from "./format.js";

// Simple 24×24 line icons, same stroke style as the category badges.
const ICONS = {
  up: `<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>`,
  down: `<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>`,
  wallet: `<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>`,
  alert: `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
  flag: `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>`,
  arrow: `<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>`,
};

// Returns an array of insight tiles for the currently viewed period:
//   { tone: 'good' | 'bad' | 'info', icon, tag, metric, title, sub, meter? }
// `metric` is the big number, `title` the what, `sub` the context line.
// Nothing forced: if there isn't enough data to say something meaningful
// (e.g. a category had ₱0 last period, so "up 400%" would just be noise),
// that insight is skipped rather than shown with misleading numbers.
export function computeInsights() {
  const insights = [];
  const currentPeriod = state.monthKey;
  const prevPeriod = monthsBack(2)[0];

  const currentByCategory = categorySpendForMonth(currentPeriod);
  const prevByCategory = categorySpendForMonth(prevPeriod);

  let biggestIncrease = null;
  let biggestDecrease = null;
  for (const cat in currentByCategory) {
    const curr = currentByCategory[cat];
    const prev = prevByCategory[cat] || 0;
    if (prev < 100 || curr < 100) continue; // skip tiny amounts — too noisy to be a meaningful % swing
    const pctChange = ((curr - prev) / prev) * 100;
    if (
      pctChange >= 15 &&
      (!biggestIncrease || pctChange > biggestIncrease.pct)
    ) {
      biggestIncrease = { cat, pct: pctChange };
    }
    if (
      pctChange <= -15 &&
      (!biggestDecrease || pctChange < biggestDecrease.pct)
    ) {
      biggestDecrease = { cat, pct: pctChange };
    }
  }

  if (biggestIncrease) {
    insights.push({
      tone: "bad",
      icon: "up",
      tag: "More spent",
      metric: `+${Math.round(biggestIncrease.pct)}%`,
      title: catInfo(biggestIncrease.cat).label,
      sub: "more than last period",
    });
  }
  if (biggestDecrease) {
    insights.push({
      tone: "good",
      icon: "down",
      tag: "Less spent",
      metric: `\u2212${Math.round(Math.abs(biggestDecrease.pct))}%`,
      title: catInfo(biggestDecrease.cat).label,
      sub: "less than last period",
    });
  }

  // Savings rate for the period being viewed
  const salary = Number(DATA.salary[currentPeriod]) || 0;
  const extraIncome = monthTx("income").reduce(
    (s, t) => s + Number(t.amount || 0),
    0,
  );
  const totalIncome = salary + extraIncome;
  const totalExpense = monthTx("expense").reduce(
    (s, t) => s + Number(t.amount || 0),
    0,
  );
  if (totalIncome > 0) {
    const savingsRate = Math.round(
      ((totalIncome - totalExpense) / totalIncome) * 100,
    );
    if (savingsRate >= 0) {
      insights.push({
        tone: "good",
        icon: "wallet",
        tag: "Savings",
        metric: `${savingsRate}%`,
        title: "Saved so far",
        sub: "of income this period",
        meter: Math.min(100, savingsRate),
      });
    } else {
      insights.push({
        tone: "bad",
        icon: "alert",
        tag: "Cash flow",
        metric: `+${Math.abs(savingsRate)}%`,
        title: "Over your income",
        sub: "spent more than you earned",
      });
    }
  }

  // Over-budget categories — measured against this half-month's own limit
  // (budgetFor), so a category can be over in one half and fine in the other.
  // Only categories with spending this period can be over, so those are the
  // ones checked.
  const overBudget = [];
  Object.keys(currentByCategory).forEach((catId) => {
    const limit = budgetFor(catId);
    if (limit > 0 && currentByCategory[catId] > limit) overBudget.push(catId);
  });
  if (overBudget.length === 1) {
    insights.push({
      tone: "bad",
      icon: "flag",
      tag: "Budget",
      metric: "Over",
      title: catInfo(overBudget[0]).label,
      sub: "budget this period",
    });
  } else if (overBudget.length > 1) {
    insights.push({
      tone: "bad",
      icon: "flag",
      tag: "Budget",
      metric: String(overBudget.length),
      title: "Categories over",
      sub: "budget this period",
    });
  }

  // Biggest single expense this period
  const periodExpenses = monthTx("expense");
  if (periodExpenses.length > 0) {
    const biggest = periodExpenses.reduce(
      (max, t) => (Number(t.amount) > Number(max.amount) ? t : max),
      periodExpenses[0],
    );
    if (Number(biggest.amount) > 0) {
      insights.push({
        tone: "info",
        icon: "arrow",
        tag: "Top expense",
        metric: fmt(biggest.amount),
        title: biggest.desc || catInfo(biggest.category).label,
        sub: "biggest single expense",
      });
    }
  }

  return insights.slice(0, 4); // cap at 4 — scannable, not overwhelming
}

// Fixed: this used to do `t.date.startsWith(monthKey)`, which worked fine
// when monthKey was a plain "YYYY-MM" calendar month, but breaks with
// semi-monthly period keys like "2026-09-1" — "2026-09-10".startsWith(
// "2026-09-1") is true (wrongly matches the 1st-15th period) while
// "2026-09-01".startsWith("2026-09-1") is FALSE (wrongly excludes day 1).
// Range comparison on the ISO date strings is what actually works.
function categorySpendForMonth(periodKey) {
  const { start, end } = periodRange(periodKey);
  const byCategory = {};
  DATA.transactions.forEach((t) => {
    if (
      t.type !== "expense" ||
      !t.date ||
      t.date < start ||
      t.date > end ||
      isSeparatelyTracked(t)
    )
      return;
    byCategory[t.category] =
      (byCategory[t.category] || 0) + Number(t.amount || 0);
  });
  return byCategory;
}

// Long amounts ("₱123,456.00") would run past the edge of a half-width tile
// at the full 24px, so the big number steps down as it gets longer.
function metricFontSize(metric) {
  if (metric.length > 11) return 17;
  if (metric.length > 9) return 20;
  return 24;
}

function renderTile(i, index) {
  return `
  <div class="ins-tile ins-${i.tone}" style="animation-delay:${index * 60}ms;">
    <div class="ins-top">
      <span class="ins-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[i.icon]}</svg></span>
      <span class="ins-tag">${escapeHtml(i.tag)}</span>
    </div>
    <div class="ins-metric" style="font-size:${metricFontSize(i.metric)}px;">${escapeHtml(i.metric)}</div>
    <div class="ins-title">${escapeHtml(i.title)}</div>
    <div class="ins-sub">${escapeHtml(i.sub)}</div>
    ${i.meter !== undefined ? `<div class="ins-meter"><span style="width:${Math.max(i.meter, 2)}%"></span></div>` : ""}
  </div>`;
}

// Renders the whole section, or an empty string if there's nothing
// meaningful to say yet (e.g. a brand-new account with only a few
// transactions) — designed to disappear cleanly rather than show an awkward
// empty box.
export function renderInsightsCard() {
  const insights = computeInsights();
  if (insights.length === 0) return "";

  return `
  <div class="section-title">Insights <span class="sub">this period</span></div>
  <div class="ins-grid">
    ${insights.map(renderTile).join("")}
  </div>`;
}
