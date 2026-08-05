import { DATA } from "../state.js";
import { fmt, escapeHtml } from "../format.js";
import { savedAmount, paceHint, monthLabel } from "../goals.js";

export function renderGoalsTab() {
  const goals = DATA.goals;

  if (goals.length === 0) {
    return `
    <div class="section-title">Goals <span class="sub">save toward something</span></div>
    <div class="empty-state">
      <div class="glyph">₱</div>
      <p>No savings goals yet.<br/>Tap + to start one — an emergency fund, a trip, anything with a target.</p>
    </div>`;
  }

  const cards = goals
    .map((goal) => {
      const saved = savedAmount(goal.id);
      const pct = Math.min(100, (saved / goal.targetAmount) * 100);
      const complete = saved >= goal.targetAmount;
      const hint = paceHint(goal);

      return `
    <div class="goal-card" data-goal="${goal.id}">
      <div class="goal-top">
        <div class="goal-name">${escapeHtml(goal.name)}${complete ? ' <span class="goal-done">✓ Reached</span>' : ""}</div>
        ${goal.targetMonth ? `<span class="goal-target-badge">by ${monthLabel(goal.targetMonth)}</span>` : ""}
      </div>
      <div class="goal-amounts">
        <span class="goal-saved">${fmt(saved)}</span>
        <span class="goal-of">of ${fmt(goal.targetAmount)}</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(pct, 2)}%;background:${complete ? "var(--green)" : "var(--gold)"}"></div></div>
      ${hint ? `<div class="goal-pace">${hint}</div>` : ""}
    </div>`;
    })
    .join("");

  return `
  <div class="section-title">Goals <span class="sub">${goals.length} tracked</span></div>
  <div class="goal-stack">${cards}</div>
  `;
}
