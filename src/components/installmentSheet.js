import { escapeHtml, fmt, formatDate } from "../format.js";
import { openModal, closeModal } from "./modal.js";
import { flashField as flash } from "../dom.js";
import { walletField } from "./walletField.js";
import { currentRealMonthKey } from "../bills.js";
import {
  DUE_RULES,
  createInstallment,
  updateInstallment,
  deleteInstallment,
  markInstallmentPaid,
  undoInstallmentPayment,
  findPayment,
  paymentsFor,
  isActive,
  progressLabel,
  progressPercent,
  remainingBalance,
  dueDateFor,
  dueRuleLabel,
} from "../installments.js";

let onChange = () => {};

export function initInstallmentSheets(rerenderCallback) {
  onChange = rerenderCallback;
}

// ── Create / edit ───────────────────────────────────────────────────────
export function openInstallmentForm(plan) {
  const heading = plan ? "Edit installment" : "New installment";
  let dueRule = plan ? plan.dueRule : "last";
  // The monthly amount is suggested from total ÷ months until the person types
  // their own (SPayLater adds fees, so the real figure often differs).
  let monthlyTouched = !!plan;
  let remainingTouched = !!plan;

  openModal(`
    <div class="grabber"></div>
    <h3>${heading}</h3>
    <div class="field">
      <label for="inName">Item name</label>
      <input id="inName" type="text" maxlength="80" placeholder="e.g. Phone, Aircon, Shopee order" value="${escapeHtml(plan?.name || "")}"/>
    </div>
    <div class="field amount">
      <label for="inTotal">Total amount</label>
      <input id="inTotal" type="number" inputmode="decimal" placeholder="0.00" value="${plan?.totalAmount || ""}"/>
    </div>
    <div class="field amount">
      <label for="inMonthly">Monthly payment</label>
      <input id="inMonthly" type="number" inputmode="decimal" placeholder="0.00" value="${plan?.monthlyAmount || ""}"/>
    </div>
    <div class="field">
      <label for="inMonths">Total months</label>
      <input id="inMonths" type="number" inputmode="numeric" min="1" max="120" placeholder="e.g. 6" value="${plan?.totalMonths || ""}"/>
    </div>
    <div class="field">
      <label for="inRemaining">Remaining months</label>
      <input id="inRemaining" type="number" inputmode="numeric" min="0" max="120" placeholder="Same as total months" value="${plan ? plan.remainingMonths : ""}"/>
      <p class="field-hint">Already paid some? Lower this to what is left, and the app will show the right month (for example "Month 3 of 6").</p>
    </div>
    <div class="field">
      <label>Monthly due date</label>
      <div class="auth-tabs" id="inDueTabs" role="radiogroup" aria-label="Monthly due date">
        ${DUE_RULES.map(
          (r) =>
            `<button type="button" class="auth-tab ${r.id === dueRule ? "active" : ""}" role="radio" aria-checked="${r.id === dueRule}" data-rule="${r.id}">${escapeHtml(r.label)}</button>`,
        ).join("")}
      </div>
      <p class="field-hint">SPayLater bills on the 15th or the last day of the month, depending on your cycle.</p>
    </div>
    <div class="sheet-actions">
      ${plan ? `<button class="btn btn-danger" id="inDeleteBtn">Delete</button>` : ""}
      <button class="btn btn-ghost" id="inCancelBtn">Cancel</button>
      <button class="btn btn-primary" id="inSaveBtn">Save</button>
    </div>
  `);

  const $ = (id) => document.getElementById(id);

  document.querySelectorAll("#inDueTabs [data-rule]").forEach((btn) => {
    btn.onclick = () => {
      dueRule = btn.dataset.rule;
      document.querySelectorAll("#inDueTabs [data-rule]").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("active", on);
        b.setAttribute("aria-checked", String(on));
      });
    };
  });

  function suggest() {
    const total = Number($("inTotal").value);
    const months = Math.round(Number($("inMonths").value));
    if (!monthlyTouched && total > 0 && months >= 1) {
      $("inMonthly").value = (Math.round((total / months) * 100) / 100).toFixed(
        2,
      );
    }
    if (!remainingTouched && months >= 1) $("inRemaining").value = months;
  }
  $("inTotal").oninput = suggest;
  $("inMonths").oninput = suggest;
  $("inMonthly").oninput = () => {
    monthlyTouched = true;
  };
  $("inRemaining").oninput = () => {
    remainingTouched = true;
  };

  $("inCancelBtn").onclick = closeModal;

  let saving = false;
  $("inSaveBtn").onclick = () => {
    if (saving) return;
    const name = $("inName").value.trim();
    const totalAmount = Number($("inTotal").value);
    const monthlyAmount = Number($("inMonthly").value);
    const totalMonths = Number($("inMonths").value);
    const remainingRaw = $("inRemaining").value;
    const remainingMonths =
      remainingRaw === "" ? totalMonths : Number(remainingRaw);

    if (!name) return flash("inName");
    if (!(totalAmount > 0)) return flash("inTotal");
    if (!(monthlyAmount > 0)) return flash("inMonthly");
    if (!Number.isInteger(totalMonths) || totalMonths < 1 || totalMonths > 120)
      return flash("inMonths");
    if (
      !Number.isInteger(remainingMonths) ||
      remainingMonths < 0 ||
      remainingMonths > totalMonths
    )
      return flash("inRemaining");

    const fields = {
      name,
      totalAmount,
      monthlyAmount,
      totalMonths,
      remainingMonths,
      dueRule,
    };
    saving = true;
    $("inSaveBtn").disabled = true;
    if (plan) updateInstallment(plan, fields);
    else createInstallment(fields);
    closeModal();
    onChange();
  };

  if (plan) {
    $("inDeleteBtn").onclick = () => {
      if (
        !window.confirm(
          `Delete "${plan.name}"? Payments you already recorded stay in your expenses.`,
        )
      )
        return;
      deleteInstallment(plan.id);
      closeModal();
      onChange();
    };
  }
}

// ── Detail: progress, this month's payment, history ─────────────────────
export function openInstallmentDetail(plan) {
  const monthKey = currentRealMonthKey();
  const active = isActive(plan);
  const paidTx = findPayment(plan.id, monthKey);
  const dueDate = dueDateFor(plan.dueRule, monthKey);
  const pct = progressPercent(plan);
  const history = paymentsFor(plan.id).slice(0, 6);

  let action;
  if (paidTx) {
    action = `<p class="auth-message">This month's payment is in: ${fmt(paidTx.amount)} on ${formatDate(paidTx.date)}.</p>`;
  } else if (active) {
    action = `
    <div class="field amount">
      <label for="inPayAmount">Pay this month</label>
      <input id="inPayAmount" type="number" inputmode="decimal" placeholder="0.00" value="${plan.monthlyAmount}"/>
    </div>
    <div class="field">
      <label for="inPayDate">Date paid</label>
      <input id="inPayDate" type="date" value="${dueDate}"/>
    </div>
    ${walletField(undefined, { id: "inPayWallet", label: "Paid from" })}`;
  } else {
    action = `<p class="auth-message">All ${plan.totalMonths} payments are done. Nice.</p>`;
  }

  openModal(`
    <div class="grabber"></div>
    <h3>${escapeHtml(plan.name)}</h3>
    <p class="auth-message">${escapeHtml(progressLabel(plan))} · due ${escapeHtml(dueRuleLabel(plan.dueRule).toLowerCase())}</p>
    <div class="goal-amounts" style="margin-bottom:8px;">
      <span class="goal-saved">${fmt(plan.monthlyAmount)}</span>
      <span class="goal-of">/ month · ${fmt(plan.totalAmount)} total</span>
    </div>
    <div class="bar-track" style="margin-bottom:14px;"><div class="bar-fill" style="width:${Math.max(pct, 2)}%;background:${active ? "var(--gold)" : "var(--green)"}"></div></div>
    <div class="stat-strip">
      <div class="stat-chip">
        <div class="label">Months left</div>
        <div class="value">${plan.remainingMonths}</div>
      </div>
      <div class="stat-chip">
        <div class="label">Still owed</div>
        <div class="value">${fmt(remainingBalance(plan))}</div>
      </div>
    </div>
    ${action}
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="inEditBtn">Edit</button>
      ${!paidTx && active ? `<button class="btn btn-primary" id="inPayBtn">Mark as paid</button>` : ""}
    </div>
    ${
      history.length > 0
        ? `
    <div class="section-title" style="margin:20px 2px 8px 2px;font-size:14px;">Payments</div>
    <div class="list">
      ${history
        .map(
          (tx) => `
        <div class="row">
          <div class="info">
            <div class="desc">${fmt(tx.amount)}</div>
            <div class="meta">${formatDate(tx.date)}</div>
          </div>
          <button class="btn-undo" data-undo="${escapeHtml(tx.id)}" title="Undo this payment">Undo</button>
        </div>`,
        )
        .join("")}
    </div>`
        : ""
    }
  `);

  document.getElementById("inEditBtn").onclick = () =>
    openInstallmentForm(plan);

  const payBtn = document.getElementById("inPayBtn");
  if (payBtn) {
    let paying = false;
    payBtn.onclick = () => {
      if (paying) return;
      const amount = Number(document.getElementById("inPayAmount").value);
      const date = document.getElementById("inPayDate").value || dueDate;
      if (!(amount > 0)) return flash("inPayAmount");
      paying = true;
      payBtn.disabled = true;
      const walletEl = document.getElementById("inPayWallet");
      markInstallmentPaid(plan, {
        amount,
        date,
        walletId: walletEl ? walletEl.value || undefined : undefined,
      });
      closeModal();
      onChange();
    };
  }

  document.querySelectorAll("[data-undo]").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const tx = history.find((t) => t.id === btn.dataset.undo);
      if (!tx) return;
      undoInstallmentPayment(tx);
      onChange();
      openInstallmentDetail(plan); // reopen so the numbers are fresh
    };
  });
}
