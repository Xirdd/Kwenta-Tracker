import { DATA, saveData } from "../state.js";
import { CATEGORIES, INCOME_CATEGORIES } from "../categories.js";
import { uid, escapeHtml } from "../format.js";

let onChange = () => {}; // callback to re-render the main app, set by main.js

export function initSheet(rerenderCallback) {
  onChange = rerenderCallback;
}

function scrimEl() {
  return document.getElementById("scrim");
}
function sheetEl() {
  return document.getElementById("sheet");
}

function openSheet(html) {
  sheetEl().innerHTML = html;
  scrimEl().classList.add("show");
  sheetEl().classList.add("show");
  scrimEl().onclick = closeSheet;
}

export function closeSheet() {
  scrimEl().classList.remove("show");
  sheetEl().classList.remove("show");
}

export function openForm(type, tx) {
  const cats = type === "expense" ? CATEGORIES : INCOME_CATEGORIES;
  const selectedCat = tx ? tx.category : cats[0].id;
  const today = new Date().toISOString().slice(0, 10);
  const dateVal = tx ? tx.date : today;
  const descVal = tx ? tx.desc || "" : "";
  const amtVal = tx ? tx.amount : "";
  const heading = tx
    ? `Edit ${type === "expense" ? "expense" : "income"}`
    : `Add ${type === "expense" ? "expense" : "income"}`;

  openSheet(`
    <div class="grabber"></div>
    <h3>${heading}</h3>
    <div class="field">
      <label>Description</label>
      <input id="fDesc" type="text" placeholder="${type === "expense" ? "e.g. Jeepney fare, Meralco bill" : "e.g. 13th month pay"}" value="${escapeHtml(descVal)}"/>
    </div>
    <div class="field amount">
      <label>Amount</label>
      <input id="fAmount" type="number" inputmode="decimal" placeholder="0.00" value="${amtVal}"/>
    </div>
    <div class="field">
      <label>Category</label>
      <div class="cat-grid" id="catGrid">
        ${cats.map((c) => `<div class="cat-opt ${c.id === selectedCat ? "selected" : ""}" data-cat="${c.id}"><span class="chip" style="background:${c.color}"></span>${c.label}</div>`).join("")}
      </div>
    </div>
    <div class="field">
      <label>Date</label>
      <input id="fDate" type="date" value="${dateVal}"/>
    </div>
    <div class="sheet-actions">
      ${tx ? `<button class="btn btn-danger" id="deleteBtn">Delete</button>` : ""}
      <button class="btn btn-ghost" id="cancelBtn">Cancel</button>
      <button class="btn btn-primary" id="saveBtn">Save</button>
    </div>
  `);

  let chosenCat = selectedCat;
  document.querySelectorAll("#catGrid .cat-opt").forEach((el) => {
    el.onclick = () => {
      chosenCat = el.dataset.cat;
      document
        .querySelectorAll("#catGrid .cat-opt")
        .forEach((o) => o.classList.remove("selected"));
      el.classList.add("selected");
    };
  });

  document.getElementById("cancelBtn").onclick = closeSheet;

  document.getElementById("saveBtn").onclick = () => {
    const desc = document.getElementById("fDesc").value.trim();
    const amount = Number(document.getElementById("fAmount").value);
    const date = document.getElementById("fDate").value || today;
    if (!amount || amount <= 0) {
      flashField("fAmount");
      return;
    }
    if (tx) {
      tx.desc = desc;
      tx.amount = amount;
      tx.category = chosenCat;
      tx.date = date;
    } else {
      DATA.transactions.push({
        id: uid(),
        type,
        desc,
        amount,
        category: chosenCat,
        date,
      });
    }
    saveData();
    closeSheet();
    onChange();
  };

  if (tx) {
    document.getElementById("deleteBtn").onclick = () => confirmDelete(tx.id);
  }
}

function flashField(id) {
  const el = document.getElementById(id);
  el.style.borderColor = "var(--coral)";
  setTimeout(() => {
    el.style.borderColor = "transparent";
  }, 700);
}

function confirmDelete(id) {
  openSheet(`
    <div class="grabber"></div>
    <h3>Remove this entry?</h3>
    <p style="color:var(--ink-soft);font-size:13.5px;margin-top:-6px;">This can't be undone.</p>
    <div class="sheet-actions" style="margin-top:18px;">
      <button class="btn btn-ghost" id="cancelDel">Keep it</button>
      <button class="btn btn-danger" id="confirmDel">Remove</button>
    </div>
  `);
  document.getElementById("cancelDel").onclick = closeSheet;
  document.getElementById("confirmDel").onclick = () => {
    DATA.transactions = DATA.transactions.filter((t) => t.id !== id);
    saveData();
    closeSheet();
    onChange();
  };
}
