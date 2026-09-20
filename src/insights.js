import {
  DATA,
  state,
  monthTx,
  monthsBack,
  isSeparatelyTracked,
  periodRange,
} from "./state.js";
import { catInfo } from "./categories.js";
import { fmt, escapeHtml } from "./format.js";

// Returns an array of {icon, text} — short, computed observations about the
// currently viewed period's spending. Nothing forced: if there isn't enough
// data to say something meaningful (e.g. a category had ₱0 last period, so
// "up 400%" would just be noise), that insight is skipped rather than shown
// with misleading numbers.
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
      icon: "📈",
      text: `You spent ${Math.round(biggestIncrease.pct)}% more on ${escapeHtml(catInfo(biggestIncrease.cat).label)} this period than last.`,
    });
  }
  if (biggestDecrease) {
    insights.push({
      icon: "📉",
      text: `You spent ${Math.round(Math.abs(biggestDecrease.pct))}% less on ${escapeHtml(catInfo(biggestDecrease.cat).label)} this period than last — nice.`,
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
        icon: "💰",
        text: `You've saved ${savingsRate}% of your income so far this period.`,
      });
    } else {
      insights.push({
        icon: "⚠️",
        text: `You've spent ${Math.abs(savingsRate)}% more than you've earned this period.`,
      });
    }
  }

  // Over-budget categories — DATA.budgets is a plain object keyed by
  // category (DATA.budgets[catId] = amount), same shape overview.js
  // already reads it in.
  const overBudget = [];
  Object.entries(DATA.budgets || {}).forEach(([catId, budgetAmount]) => {
    const spent = currentByCategory[catId] || 0;
    const amt = Number(budgetAmount) || 0;
    if (amt > 0 && spent > amt) overBudget.push(catId);
  });
  if (overBudget.length === 1) {
    insights.push({
      icon: "🔺",
      text: `You're over budget on ${escapeHtml(catInfo(overBudget[0]).label)} this period.`,
    });
  } else if (overBudget.length > 1) {
    insights.push({
      icon: "🔺",
      text: `You're over budget in ${overBudget.length} categories this period.`,
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
        icon: "🔍",
        text: `Your biggest expense this period was ${fmt(biggest.amount)}${biggest.desc ? ` for ${escapeHtml(biggest.desc)}` : ""}.`,
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

// Renders the whole card, or an empty string if there's nothing meaningful
// to say yet (e.g. a brand-new account with only a few transactions) —
// designed to disappear cleanly rather than show an awkward empty box.
export function renderInsightsCard() {
  const insights = computeInsights();
  if (insights.length === 0) return "";

  return `
  <div class="insights-card">
    <div class="insights-title">Insights</div>
    ${insights
      .map(
        (i) => `
      <div class="insight-row">
        <span class="insight-icon">${i.icon}</span>
        <span class="insight-text">${i.text}</span>
      </div>
    `,
      )
      .join("")}
  </div>`;
}
