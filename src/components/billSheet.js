import { CATEGORIES } from "../categories.js";
import { escapeHtml, fmt, formatDate } from "../format.js";
import { openModal, closeModal } from "./modal.js";
import {
  createBill,
  updateBill,
  deleteBill,
  findPaymentTx,
  markBillPaid,
  undoBillPayment,
  dueDateStr,
  ordinalSuffix,
} from "../bills.js";

let onChange = () => {};

export function initBillSheets(rerenderCallback) {
  onChange = rerenderCallback;
}

// ── Add / edit a bill's definition (name, category, due day, estimate) ────
export function openBillForm(bill) {
  const selectedCat = bill ? bill.category : CATEGORIES[0].id;
  const heading = bill ? "Edit bill" : "Add a bill";

  openModal(`
    <div class="grabber"></div>
    <h3>${heading}</h3>
    <div class="field">
      <label>Name</label>
      <input id="bName" type="text" placeholder="e.g. Meralco, PLDT, Water" value="${escapeHtml(bill?.name || "")}"/>
    </div>
    <div class="field">
      <label>Category</label>
      <div class="cat-grid" id="bCatGrid">
        ${CATEGORIES.map((c) => `<div class="cat-opt ${c.id === selectedCat ? "selected" : ""}" data-cat="${c.id}"><span class="chip" style="background:${c.color}"></span>${c.label}</div>`).join("")}
      </div>
    </div>
    <div class="field">
      <label>Due day of month</label>
      <input id="bDueDay" type="number" inputmode="numeric" min="1" max="28" placeholder="e.g. 15" value="${bill?.dueDay || ""}"/>
    </div>
    <div class="field amount">
      <label>Estimated amount <span class="opt">(optional — prefills when you mark it paid)</span></label>
      <input id="bEstimate" type="number" inputmode="decimal" placeholder="0.00" value="${bill?.estimatedAmount ?? ""}"/>
    </div>
    <div class="sheet-actions">
      ${bill ? `<button class="btn btn-danger" id="bDeleteBtn">Delete</button>` : ""}
      <button class="btn btn-ghost" id="bCancelBtn">Cancel</button>
      <button class="btn btn-primary" id="bSaveBtn">Save</button>
    </div>
  `);

  let chosenCat = selectedCat;
  document.querySelectorAll("#bCatGrid .cat-opt").forEach((el) => {
    el.onclick = () => {
      chosenCat = el.dataset.cat;
      document
        .querySelectorAll("#bCatGrid .cat-opt")
        .forEach((o) => o.classList.remove("selected"));
      el.classList.add("selected");
    };
  });

  document.getElementById("bCancelBtn").onclick = closeModal;

  document.getElementById("bSaveBtn").onclick = () => {
    const name = document.getElementById("bName").value.trim();
    const dueDay = document.getElementById("bDueDay").value;
    const estimatedAmount = document.getElementById("bEstimate").value;
    if (!name) {
      flash("bName");
      return;
    }
    if (!dueDay || dueDay < 1 || dueDay > 28) {
      flash("bDueDay");
      return;
    }

    const payload = {
      name,
      category: chosenCat,
      dueDay: Number(dueDay),
      estimatedAmount:
        estimatedAmount === "" ? undefined : Number(estimatedAmount),
    };
    if (bill) updateBill(bill, payload);
    else createBill(payload);

    closeModal();
    onChange();
  };

  if (bill) {
    document.getElementById("bDeleteBtn").onclick = () => {
      deleteBill(bill.id);
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

// ── Mark a bill paid / view & undo a payment for the currently viewed month ─
export function openBillPaymentSheet(bill, monthKey) {
  const paidTx = findPaymentTx(bill.id, monthKey);

  if (paidTx) {
    openModal(`
      <div class="grabber"></div>
      <h3>${escapeHtml(bill.name)}</h3>
      <p class="auth-message">Paid ${fmt(paidTx.amount)} on ${formatDate(paidTx.date)}.</p>
      <div class="sheet-actions" style="flex-direction:column;">
        <button class="btn btn-danger" id="undoPaidBtn">Undo payment</button>
        <button class="btn btn-ghost" id="editBillBtn">Edit bill details</button>
      </div>
    `);
    document.getElementById("undoPaidBtn").onclick = () => {
      undoBillPayment(paidTx);
      closeModal();
      onChange();
    };
    document.getElementById("editBillBtn").onclick = () => openBillForm(bill);
    return;
  }

  const suggestedDate = dueDateStr(monthKey, bill.dueDay);
  openModal(`
    <div class="grabber"></div>
    <h3>Mark "${escapeHtml(bill.name)}" as paid</h3>
    <p class="auth-message">Due on the ${bill.dueDay}${ordinalSuffix(bill.dueDay)}. Enter what you actually paid.</p>
    <div class="field amount">
      <label>Amount</label>
      <input id="payAmount" type="number" inputmode="decimal" placeholder="0.00" value="${bill.estimatedAmount ?? ""}"/>
    </div>
    <div class="field">
      <label>Date paid</label>
      <input id="payDate" type="date" value="${suggestedDate}"/>
    </div>
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="payCancelBtn">Cancel</button>
      <button class="btn btn-primary" id="payConfirmBtn">Mark as paid</button>
    </div>
    <button class="btn btn-ghost" id="editBillBtn2" style="margin-top:10px;">Edit bill details</button>
  `);

  document.getElementById("payCancelBtn").onclick = closeModal;
  document.getElementById("editBillBtn2").onclick = () => openBillForm(bill);

  document.getElementById("payConfirmBtn").onclick = () => {
    const amount = Number(document.getElementById("payAmount").value);
    const date = document.getElementById("payDate").value || suggestedDate;
    if (!amount || amount <= 0) {
      flash("payAmount");
      return;
    }
    markBillPaid(bill, monthKey, { amount, date });
    closeModal();
    onChange();
  };
}
