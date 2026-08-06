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
      <div class="goal-row">
        ${renderGoalRing(pct, complete)}
        <div class="goal-info">
          <div class="goal-top">
            <div class="goal-name">${escapeHtml(goal.name)}${complete ? ' <span class="goal-done">✓ Reached</span>' : ""}</div>
            ${goal.targetMonth ? `<span class="goal-target-badge">by ${monthLabel(goal.targetMonth)}</span>` : ""}
          </div>
          <div class="goal-amounts">
            <span class="goal-saved">${fmt(saved)}</span>
            <span class="goal-of">of ${fmt(goal.targetAmount)}</span>
          </div>
          ${hint ? `<div class="goal-pace">${hint}</div>` : ""}
        </div>
      </div>
    </div>`;
    })
    .join("");

  return `
  <div class="section-title">Goals <span class="sub">${goals.length} tracked</span></div>
  <div class="goal-stack">${cards}</div>
  `;
}

// A small circular progress chart — radius/circumference math shared with
// the detail sheet's ring via this same exported function.
export function renderGoalRing(pct, complete) {
  const size = 64,
    r = 26,
    cx = 32,
    cy = 32,
    circ = 2 * Math.PI * r;
  const dash = (Math.max(pct, 1) / 100) * circ;
  const color = complete ? "var(--green)" : "var(--gold)";
  return `
  <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="goal-ring">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--paper-2)" stroke-width="7"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="7"
      stroke-linecap="round"
      stroke-dasharray="${dash.toFixed(2)} ${(circ - dash).toFixed(2)}"
      transform="rotate(-90 ${cx} ${cy})"/>
    <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="12.5" font-weight="700" fill="var(--ink)" font-family="'IBM Plex Mono', monospace">${Math.round(pct)}%</text>
  </svg>`;
}
