import {
  DATA,
  state,
  monthTx,
  monthsBack,
  isSeparatelyTracked,
} from "./state.js";
import { catInfo } from "./categories.js";
import { fmt, escapeHtml } from "./format.js";

export function computeInsights() {
  const insights = [];
  const currentMonth = state.monthKey;
  const prevMonth = monthsBack(2)[0];

  const currentByCategory = categorySpendForMonth(currentMonth);
  const prevByCategory = categorySpendForMonth(prevMonth);

  let biggestIncrease = null;
  let biggestDecrease = null;
  for (const cat in currentByCategory) {
    const curr = currentByCategory[cat];
    const prev = prevByCategory[cat] || 0;
    if (prev < 100 || curr < 100) continue;
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
      text: `You spent ${Math.round(biggestIncrease.pct)}% more on ${escapeHtml(catInfo(biggestIncrease.cat).label)} this month than last.`,
    });
  }
  if (biggestDecrease) {
    insights.push({
      icon: "📉",
      text: `You spent ${Math.round(Math.abs(biggestDecrease.pct))}% less on ${escapeHtml(catInfo(biggestDecrease.cat).label)} this month than last — nice.`,
    });
  }

  const salary = Number(DATA.salary[currentMonth]) || 0;
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
        text: `You've saved ${savingsRate}% of your income so far this month.`,
      });
    } else {
      insights.push({
        icon: "⚠️",
        text: `You've spent ${Math.abs(savingsRate)}% more than you've earned this month.`,
      });
    }
  }

  const overBudget = [];
  Object.entries(DATA.budgets || {}).forEach(([catId, budgetAmount]) => {
    const spent = currentByCategory[catId] || 0;
    const amt = Number(budgetAmount) || 0;
    if (amt > 0 && spent > amt) overBudget.push(catId);
  });
  if (overBudget.length === 1) {
    insights.push({
      icon: "🔺",
      text: `You're over budget on ${escapeHtml(catInfo(overBudget[0]).label)} this month.`,
    });
  } else if (overBudget.length > 1) {
    insights.push({
      icon: "🔺",
      text: `You're over budget in ${overBudget.length} categories this month.`,
    });
  }

  const monthExpenses = monthTx("expense");
  if (monthExpenses.length > 0) {
    const biggest = monthExpenses.reduce(
      (max, t) => (Number(t.amount) > Number(max.amount) ? t : max),
      monthExpenses[0],
    );
    if (Number(biggest.amount) > 0) {
      insights.push({
        icon: "🔍",
        text: `Your biggest expense this month was ${fmt(biggest.amount)}${biggest.desc ? ` for ${escapeHtml(biggest.desc)}` : ""}.`,
      });
    }
  }

  return insights.slice(0, 4);
}

function categorySpendForMonth(monthKey) {
  const byCategory = {};
  DATA.transactions.forEach((t) => {
    if (
      t.type !== "expense" ||
      !t.date ||
      !t.date.startsWith(monthKey) ||
      isSeparatelyTracked(t)
    )
      return;
    byCategory[t.category] =
      (byCategory[t.category] || 0) + Number(t.amount || 0);
  });
  return byCategory;
}

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
