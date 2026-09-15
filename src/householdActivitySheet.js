import { openModal, closeModal } from "./modal.js";
import { fetchHouseholdActivity } from "../householdActivity.js";
import { catInfo, incCatInfo } from "../categories.js";
import { fmt, escapeHtml, timeAgo } from "../format.js";

export function openHouseholdActivitySheet(householdId) {
  render(householdId);
}

async function render(householdId) {
  openModal(
    `<div class="grabber"></div><h3>Household activity</h3><p class="auth-message">Loading…</p>`,
    closeModal,
  );

  let rows;
  try {
    rows = await fetchHouseholdActivity(householdId);
  } catch (e) {
    renderError(e.message || "Couldn't load activity right now.");
    return;
  }
  renderList(rows);
}

function renderError(message) {
  openModal(
    `
    <div class="grabber"></div>
    <h3>Household activity</h3>
    <p class="auth-message" style="color:var(--coral);">${message}</p>
    <div class="sheet-actions"><button class="btn btn-ghost" id="activityCloseBtn">Close</button></div>
  `,
    closeModal,
  );
  document.getElementById("activityCloseBtn").onclick = closeModal;
}

function renderList(rows) {
  const items = rows.length
    ? rows.map((r) => renderRow(r)).join("")
    : `<div class="empty-state"><div class="glyph" style="font-size:28px;">📋</div><p>Nothing logged yet.<br/>Activity from every household member will show up here.</p></div>`;

  openModal(
    `
    <div class="grabber"></div>
    <h3>Household activity</h3>
    <p class="auth-message" style="margin-top:-4px;">Recent changes to shared transactions, budgets, bills, goals, and utang — most recent first.</p>
    <div class="activity-list">${items}</div>
    <div class="sheet-actions" style="margin-top:14px;">
      <button class="btn btn-ghost" id="activityCloseBtn">Close</button>
    </div>
  `,
    closeModal,
  );
  document.getElementById("activityCloseBtn").onclick = closeModal;
}

function renderRow(row) {
  const initial = (row.user_email || "?").trim().charAt(0).toUpperCase();
  const summary = formatActivitySummary(row);
  return `
  <div class="activity-row">
    <span class="activity-avatar">${initial}</span>
    <div class="activity-info">
      <div class="activity-summary"><strong>${escapeHtml(shortName(row.user_email))}</strong> ${summary}</div>
      <div class="activity-time">${timeAgo(row.created_at)}</div>
    </div>
  </div>`;
}

// Emails aren't great to show in full inline ("chad.delacruz@gmail.com added
// an expense" reads worse than "chad added an expense") — just the part
// before the @ is enough context in a household of a handful of people.
function shortName(email) {
  return (email || "someone").split("@")[0];
}

// Turns each row's structured `details` (see household_activity_log.sql)
// into a readable sentence fragment, reusing the app's own category
// labels/icons rather than duplicating that mapping in SQL. Deliberately a
// moderate level of detail — what happened and the key amount/name, not a
// full old-value-vs-new-value diff (see the SQL file's own header for why).
function formatActivitySummary(row) {
  const verb =
    row.action === "insert"
      ? "added"
      : row.action === "update"
        ? "updated"
        : "deleted";
  const d = row.details || {};

  switch (row.table_name) {
    case "kwenta_transactions": {
      const isIncome = d.type === "income";
      const cat = isIncome ? incCatInfo(d.category) : catInfo(d.category);
      const label = d.desc || cat.label;
      return `${verb} ${isIncome ? "income" : "an expense"}: ${escapeHtml(label)} (${fmt(d.amount)})`;
    }
    case "kwenta_budgets":
      return `${verb} the ${escapeHtml(catInfo(d.category).label)} budget to ${fmt(d.amount)}`;
    case "kwenta_bills":
      return `${verb} a bill: ${escapeHtml(d.name || "")}`;
    case "kwenta_goals":
      return `${verb} a goal: ${escapeHtml(d.name || "")}${d.targetAmount ? ` (${fmt(d.targetAmount)} target)` : ""}`;
    case "kwenta_loans":
      return `${verb} an utang entry: ${escapeHtml(d.person || "")}${d.amount ? ` (${fmt(d.amount)})` : ""}`;
    case "kwenta_recurring":
      return `${verb} a recurring ${d.type || "entry"}: ${escapeHtml(d.desc || "")}`;
    default:
      return `${verb} something`;
  }
}
