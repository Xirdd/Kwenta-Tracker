import { DATA } from "../state.js";
import { fmt, escapeHtml } from "../format.js";
import { savedAmount, paceHint, monthLabel } from "../goals.js";

// A vibrant, varied palette distinct from the fixed expense-category colors
// — goals are personal and aspirational, so each one gets its own accent
// rather than everything sharing the same gold ring.
const PALETTE = [
  "#ff5470",
  "#4f8cff",
  "#ffb020",
  "#8e5fd6",
  "#2fb8a6",
  "#e2568f",
  "#7fae3f",
  "#29c5d6",
];

// Deterministic (hashed from the goal's id) so the same goal always gets the
// same color everywhere it appears — the list and the detail sheet — without
// needing to store a color choice anywhere.
export function goalAccentColor(goalId) {
  let hash = 0;
  for (let i = 0; i < goalId.length; i++) {
    hash = (hash * 31 + goalId.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export function renderGoalsTab() {
  const goals = DATA.goals;

  if (goals.length === 0) {
    return `
    <div class="section-title">Goals <span class="sub">save toward something</span></div>
    <div class="empty-state">
      <div class="glyph" style="font-size:32px;">🎯</div>
      <p>No savings goals yet.<br/>Tap + to start one — an emergency fund, a trip, anything with a target.</p>
    </div>`;
  }

  const cards = goals
    .map((goal, i) => {
      const saved = savedAmount(goal.id);
      const pct = Math.min(100, (saved / goal.targetAmount) * 100);
      const complete = saved >= goal.targetAmount;
      const hot = !complete && pct >= 80;
      const hint = paceHint(goal);
      const color = goalAccentColor(goal.id);

      return `
    <div class="goal-card ${complete ? "complete" : ""} ${hot ? "hot" : ""}" data-goal="${goal.id}" style="--goal-accent:${color};animation-delay:${i * 70}ms;">
      <div class="goal-glow"></div>
      <div class="goal-row">
        ${renderGoalRing(pct, complete, color, goal.id)}
        <div class="goal-info">
          <div class="goal-top">
            <div class="goal-name">${escapeHtml(goal.name)}</div>
            ${goal.targetMonth ? `<span class="goal-target-badge">by ${monthLabel(goal.targetMonth)}</span>` : ""}
          </div>
          <div class="goal-amounts">
            <span class="goal-saved">${fmt(saved)}</span>
            <span class="goal-of">of ${fmt(goal.targetAmount)}</span>
          </div>
          ${
            complete
              ? `<div class="goal-done-pill">🎉 Goal reached!</div>`
              : hint
                ? `<div class="goal-pace">${hint}</div>`
                : ""
          }
        </div>
      </div>
    </div>`;
    })
    .join("");

  return `
  <div class="section-title">Goals <span class="sub">${goals.length} tracked</span></div>
  ${renderGoalsSummary(goals)}
  <div class="goal-stack">${cards}</div>
  `;
}

// A quick motivational strip above the list: total saved across every goal,
// plus a nudge toward whichever one is closest to the finish line (or a
// celebration line if everything's already done). Small touch, but it makes
// the tab feel like it's actually rooting for you rather than just reporting
// numbers back.
function renderGoalsSummary(goals) {
  const totalSaved = goals.reduce((s, g) => s + savedAmount(g.id), 0);
  const progressList = goals.map((g) => ({
    g,
    pct: Math.min(100, (savedAmount(g.id) / g.targetAmount) * 100),
  }));
  const closest = progressList
    .filter((x) => x.pct < 100)
    .sort((a, b) => b.pct - a.pct)[0];

  return `
  <div class="goals-summary-banner">
    <div class="goals-summary-main">
      <span class="goals-summary-label">Total saved across goals</span>
      <span class="goals-summary-amount">${fmt(totalSaved)}</span>
    </div>
    <div class="goals-summary-hint">
      ${
        closest
          ? `🔥 Closest to done: <strong>${escapeHtml(closest.g.name)}</strong> — ${Math.round(closest.pct)}%`
          : `🎉 Every goal reached — go set a new one!`
      }
    </div>
  </div>`;
}

// A small circular progress chart — radius/circumference math shared with
// the detail sheet's ring via this same exported function. `color` is the
// goal's own accent (see goalAccentColor); completed goals always render in
// green regardless of accent, so "done" reads unambiguously at a glance.
// `goalId` only needs to be unique enough to avoid duplicate SVG gradient
// ids when the list and the detail sheet are both in the DOM at once.
let ringInstanceCounter = 0;
export function renderGoalRing(
  pct,
  complete,
  color = "#00d68f",
  goalId = "shared",
) {
  const size = 68,
    r = 27,
    cx = 34,
    cy = 34,
    circ = 2 * Math.PI * r;
  const dash = (Math.max(pct, 1) / 100) * circ;
  const ringColor = complete ? "#00d68f" : color;
  const gradId = `goalRingGrad-${goalId}-${ringInstanceCounter++}`;
  return `
  <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="goal-ring">
    <defs>
      <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${ringColor}"/>
        <stop offset="100%" stop-color="${ringColor}" stop-opacity="0.6"/>
      </linearGradient>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--paper-2)" stroke-width="7"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#${gradId})" stroke-width="7"
      stroke-linecap="round"
      stroke-dasharray="${dash.toFixed(2)} ${(circ - dash).toFixed(2)}"
      transform="rotate(-90 ${cx} ${cy})"/>
    <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="12.5" font-weight="800" fill="var(--ink)" font-family="'IBM Plex Mono', 'SF Mono', 'Menlo', 'Roboto Mono', 'Consolas', monospace">${complete ? "✓" : Math.round(pct) + "%"}</text>
  </svg>`;
}
