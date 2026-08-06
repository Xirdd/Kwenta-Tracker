import { escapeHtml, fmt, formatDate } from "../format.js";
import { openModal, closeModal } from "./modal.js";
import {
  createLoan,
  updateLoan,
  deleteLoan,
  remainingAmount,
  repaymentsFor,
  addRepayment,
  removeRepayment,
} from "../loans.js";

let onChange = () => {};

export function initLoanSheets(rerenderCallback) {
  onChange = rerenderCallback;
}

// ── Add / edit a loan ──────────────────────────────────────────────────
export function openLoanForm(loan) {
  const today = new Date().toISOString().slice(0, 10);
  const heading = loan ? "Edit utang" : "Log money lent or borrowed";
  let direction = loan ? loan.direction : "lent";

  openModal(`
    <div class="grabber"></div>
    <h3>${heading}</h3>
    ${
      !loan
        ? `
    <div class="field">
      <label>Direction</label>
      <div class="auth-tabs" id="directionTabs">
        <button type="button" class="auth-tab active" data-dir="lent">They owe me</button>
        <button type="button" class="auth-tab" data-dir="borrowed">I owe them</button>
      </div>
    </div>`
        : ""
    }
    <div class="field">
      <label>Person</label>
      <input id="lPerson" type="text" placeholder="e.g. Ate Jhen, Kuya Mark" value="${escapeHtml(loan?.person || "")}"/>
    </div>
    <div class="field amount">
      <label>Amount</label>
      <input id="lAmount" type="number" inputmode="decimal" placeholder="0.00" value="${loan?.amount ?? ""}"/>
    </div>
    <div class="field">
      <label>Date</label>
      <input id="lDate" type="date" value="${loan?.date || today}"/>
    </div>
    <div class="field">
      <label>Note <span class="opt">(optional)</span></label>
      <input id="lNote" type="text" placeholder="e.g. for hospital bill" value="${escapeHtml(loan?.note || "")}"/>
    </div>
    <div class="sheet-actions">
      ${loan ? `<button class="btn btn-danger" id="lDeleteBtn">Delete</button>` : ""}
      <button class="btn btn-ghost" id="lCancelBtn">Cancel</button>
      <button class="btn btn-primary" id="lSaveBtn">Save</button>
    </div>
  `);

  if (!loan) {
    document.querySelectorAll("#directionTabs .auth-tab").forEach((btn) => {
      btn.onclick = () => {
        direction = btn.dataset.dir;
        document
          .querySelectorAll("#directionTabs .auth-tab")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      };
    });
  }

  document.getElementById("lCancelBtn").onclick = closeModal;

  document.getElementById("lSaveBtn").onclick = () => {
    const person = document.getElementById("lPerson").value.trim();
    const amount = Number(document.getElementById("lAmount").value);
    const date = document.getElementById("lDate").value || today;
    const note = document.getElementById("lNote").value.trim();
    if (!person) {
      flash("lPerson");
      return;
    }
    if (!amount || amount <= 0) {
      flash("lAmount");
      return;
    }

    if (loan) updateLoan(loan, { person, amount, date, note });
    else createLoan({ person, direction, amount, date, note });

    closeModal();
    onChange();
  };

  if (loan) {
    document.getElementById("lDeleteBtn").onclick = () => {
      deleteLoan(loan.id);
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

// ── View progress, record a payment, see & undo recent repayments ────────
export function openLoanDetail(loan) {
  const remaining = remainingAmount(loan);
  const settled = remaining <= 0;
  const owedToYou = loan.direction === "lent";
  const paidPct =
    loan.amount > 0 ? ((loan.amount - remaining) / loan.amount) * 100 : 0;
  const recent = repaymentsFor(loan.id).slice(0, 5);
  const today = new Date().toISOString().slice(0, 10);

  openModal(`
    <div class="grabber"></div>
    <h3>${escapeHtml(loan.person)}</h3>
    <p class="auth-message">${settled ? "Settled" : owedToYou ? "Owes you" : "You owe"}${loan.note ? ` · ${escapeHtml(loan.note)}` : ""}</p>
    <div class="goal-amounts" style="margin-bottom:8px;">
      <span class="goal-saved">${fmt(remaining)}</span>
      <span class="goal-of">of ${fmt(loan.amount)}</span>
    </div>
    <div class="bar-track" style="margin-bottom:14px;"><div class="bar-fill" style="width:${Math.max(paidPct, 2)}%;background:${settled ? "var(--green)" : owedToYou ? "var(--green)" : "var(--coral)"}"></div></div>

    ${
      !settled
        ? `
    <div class="field amount">
      <label>Record a payment</label>
      <input id="repayAmount" type="number" inputmode="decimal" placeholder="0.00"/>
    </div>
    <div class="field">
      <label>Date</label>
      <input id="repayDate" type="date" value="${today}"/>
    </div>
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="lEditBtn">Edit details</button>
      <button class="btn btn-primary" id="repayBtn">${owedToYou ? "They paid" : "I paid"}</button>
    </div>`
        : `
    <div class="sheet-actions" style="flex-direction:column;">
      <button class="btn btn-ghost" id="lEditBtn">Edit details</button>
    </div>`
    }

    ${
      recent.length > 0
        ? `
    <div class="section-title" style="margin:20px 2px 8px 2px;font-size:14px;">Recent payments</div>
    <div class="list">
      ${recent
        .map(
          (tx) => `
        <div class="row">
          <div class="info">
            <div class="desc">${fmt(tx.amount)}</div>
            <div class="meta">${formatDate(tx.date)}</div>
          </div>
          <button class="btn-undo" data-undo="${tx.id}" title="Undo this payment">Undo</button>
        </div>
      `,
        )
        .join("")}
    </div>`
        : ""
    }
  `);

  document.getElementById("lEditBtn").onclick = () => openLoanForm(loan);

  const repayBtn = document.getElementById("repayBtn");
  if (repayBtn) {
    repayBtn.onclick = () => {
      const amount = Number(document.getElementById("repayAmount").value);
      const date = document.getElementById("repayDate").value || today;
      if (!amount || amount <= 0) {
        flash("repayAmount");
        return;
      }
      addRepayment(loan, { amount, date });
      closeModal();
      onChange();
    };
  }

  document.querySelectorAll("[data-undo]").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const tx = recent.find((t) => t.id === btn.dataset.undo);
      if (tx) {
        removeRepayment(tx);
        onChange();
        openLoanDetail(loan); // refresh the sheet in place with updated numbers
      }
    };
  });
}
