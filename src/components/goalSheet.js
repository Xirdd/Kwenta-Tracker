import { escapeHtml, fmt, formatDate } from "../format.js";
import { openModal, closeModal } from "./modal.js";
import {
  createGoal,
  updateGoal,
  deleteGoal,
  savedAmount,
  contributionsFor,
  addContribution,
  removeContribution,
  paceHint,
} from "../goals.js";

let onChange = () => {};

export function initGoalSheets(rerenderCallback) {
  onChange = rerenderCallback;
}

// ── Add / edit a goal's definition ────────────────────────────────────────
export function openGoalForm(goal) {
  const heading = goal ? "Edit goal" : "New savings goal";

  openModal(`
    <div class="grabber"></div>
    <h3>${heading}</h3>
    <div class="field">
      <label>What are you saving for?</label>
      <input id="gName" type="text" placeholder="e.g. Emergency fund, Baguio trip" value="${escapeHtml(goal?.name || "")}"/>
    </div>
    <div class="field amount">
      <label>Target amount</label>
      <input id="gTarget" type="number" inputmode="decimal" placeholder="20000" value="${goal?.targetAmount ?? ""}"/>
    </div>
    <div class="field">
      <label>Target month <span class="opt">(optional)</span></label>
      <input id="gMonth" type="month" value="${goal?.targetMonth || ""}"/>
    </div>
    <div class="sheet-actions">
      ${goal ? `<button class="btn btn-danger" id="gDeleteBtn">Delete</button>` : ""}
      <button class="btn btn-ghost" id="gCancelBtn">Cancel</button>
      <button class="btn btn-primary" id="gSaveBtn">Save</button>
    </div>
  `);

  document.getElementById("gCancelBtn").onclick = closeModal;

  document.getElementById("gSaveBtn").onclick = () => {
    const name = document.getElementById("gName").value.trim();
    const targetAmount = Number(document.getElementById("gTarget").value);
    const targetMonth = document.getElementById("gMonth").value || undefined;
    if (!name) {
      flash("gName");
      return;
    }
    if (!targetAmount || targetAmount <= 0) {
      flash("gTarget");
      return;
    }

    if (goal) updateGoal(goal, { name, targetAmount, targetMonth });
    else createGoal({ name, targetAmount, targetMonth });

    closeModal();
    onChange();
  };

  if (goal) {
    document.getElementById("gDeleteBtn").onclick = () => {
      deleteGoal(goal.id);
      closeModal();
      onChange();
    };
  }
}

function flash(id) {
  const el = document.getElementById(id);
  el.style.borderColor = "var(--coral)";
  setTimeout(() => {
    el.style.borderColor = "transparent";
  }, 700);
}

// ── View progress, add money, see & undo recent contributions ───────────
export function openGoalDetail(goal) {
  const saved = savedAmount(goal.id);
  const pct = Math.min(100, (saved / goal.targetAmount) * 100);
  const complete = saved >= goal.targetAmount;
  const hint = paceHint(goal);
  const recent = contributionsFor(goal.id).slice(0, 5);
  const today = new Date().toISOString().slice(0, 10);

  openModal(`
    <div class="grabber"></div>
    <h3>${escapeHtml(goal.name)}</h3>
    <div class="goal-amounts" style="margin-bottom:8px;">
      <span class="goal-saved">${fmt(saved)}</span>
      <span class="goal-of">of ${fmt(goal.targetAmount)}</span>
    </div>
    <div class="bar-track" style="margin-bottom:10px;"><div class="bar-fill" style="width:${Math.max(pct, 2)}%;background:${complete ? "var(--green)" : "var(--gold)"}"></div></div>
    ${hint ? `<p class="auth-message">${hint}</p>` : ""}

    <div class="field amount">
      <label>Add money</label>
      <input id="addAmount" type="number" inputmode="decimal" placeholder="0.00"/>
    </div>
    <div class="field">
      <label>Date</label>
      <input id="addDate" type="date" value="${today}"/>
    </div>
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="gEditBtn">Edit goal</button>
      <button class="btn btn-primary" id="addMoneyBtn">Add money</button>
    </div>

    ${
      recent.length > 0
        ? `
    <div class="section-title" style="margin:20px 2px 8px 2px;font-size:14px;">Recent contributions</div>
    <div class="list">
      ${recent
        .map(
          (tx) => `
        <div class="row">
          <div class="info">
            <div class="desc">${fmt(tx.amount)}</div>
            <div class="meta">${formatDate(tx.date)}</div>
          </div>
          <button class="btn-undo" data-undo="${tx.id}" title="Undo this contribution">Undo</button>
        </div>
      `,
        )
        .join("")}
    </div>`
        : ""
    }
  `);

  document.getElementById("gEditBtn").onclick = () => openGoalForm(goal);

  document.getElementById("addMoneyBtn").onclick = () => {
    const amount = Number(document.getElementById("addAmount").value);
    const date = document.getElementById("addDate").value || today;
    if (!amount || amount <= 0) {
      flash("addAmount");
      return;
    }
    addContribution(goal, { amount, date });
    closeModal();
    onChange();
  };

  document.querySelectorAll("[data-undo]").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const tx = recent.find((t) => t.id === btn.dataset.undo);
      if (tx) {
        removeContribution(tx);
        onChange();
        openGoalDetail(goal); // refresh the sheet in place with updated numbers
      }
    };
  });
}
