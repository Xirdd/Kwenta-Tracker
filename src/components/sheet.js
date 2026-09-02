import { DATA, saveData } from "../state.js";
import {
  CATEGORIES,
  INCOME_CATEGORIES,
  categoryIconBadge,
} from "../categories.js";
import { uid, escapeHtml } from "../format.js";
import { openModal, closeModal } from "./modal.js";
import {
  isCloudMode,
  cloudUpsertTransaction,
  cloudDeleteTransaction,
} from "../sync.js";
import { notifySyncError } from "../toast.js";
import {
  createRecurringRule,
  updateRecurringTemplate,
  stopRecurringRule,
} from "../recurring.js";

let onChange = () => {}; // callback to re-render the main app, set by main.js

export function initSheet(rerenderCallback) {
  onChange = rerenderCallback;
}

export const closeSheet = closeModal;

export function openForm(type, tx) {
  const cats = type === "expense" ? CATEGORIES : INCOME_CATEGORIES;
  const selectedCat = tx ? tx.category : cats[0].id;
  const today = new Date().toISOString().slice(0, 10);
  const dateVal = tx ? tx.date : today;
  const descVal = tx ? tx.desc || "" : "";
  const amtVal = tx ? tx.amount : "";
  const wasRecurring = !!(tx && tx.recurringId);
  const heading = tx
    ? `Edit ${type === "expense" ? "expense" : "income"}`
    : `Add ${type === "expense" ? "expense" : "income"}`;
  let tags = tx && tx.tags ? [...tx.tags] : [];

  openModal(`
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
        ${cats.map((c) => `<div class="cat-opt ${c.id === selectedCat ? "selected" : ""}" data-cat="${c.id}">${categoryIconBadge(c, 32)}${c.label}</div>`).join("")}
      </div>
    </div>
    <div class="field">
      <label>Tags <span class="opt">(optional — search by these too)</span></label>
      <div class="tag-input-wrap" id="tagInputWrap">
        <input id="tagTextInput" type="text" placeholder="${tags.length ? "" : "e.g. birthday, work trip"}"/>
      </div>
    </div>
    <div class="field">
      <label>Date</label>
      <input id="fDate" type="date" value="${dateVal}"/>
    </div>
    <div class="field">
      <label class="checkbox-row">
        <input type="checkbox" id="fRepeats" ${wasRecurring ? "checked" : ""}/>
        <span>Repeats every month</span>
      </label>
      ${wasRecurring ? `<p class="field-hint">Unchecking this stops future months — this entry stays.</p>` : `<p class="field-hint">Automatically added again next month, using this amount and category.</p>`}
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

  renderTagChips();

  function renderTagChips() {
    const wrap = document.getElementById("tagInputWrap");
    const input = document.getElementById("tagTextInput");
    // Rebuild only the chip elements, keeping the same <input> node so focus/typing isn't disrupted.
    wrap.querySelectorAll(".tag-chip").forEach((el) => el.remove());
    tags.forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.innerHTML = `${escapeHtml(tag)}<button type="button" class="tag-remove" data-tag="${escapeHtml(tag)}">×</button>`;
      wrap.insertBefore(chip, input);
    });
    wrap.querySelectorAll(".tag-remove").forEach((btn) => {
      btn.onclick = () => {
        tags = tags.filter((t) => t !== btn.dataset.tag);
        renderTagChips();
      };
    });
    input.placeholder = tags.length ? "" : "e.g. birthday, work trip";
  }

  function addTagFromInput() {
    const input = document.getElementById("tagTextInput");
    const raw = input.value.trim().replace(/,+$/, "").toLowerCase();
    input.value = "";
    if (!raw || tags.includes(raw)) {
      renderTagChips();
      return;
    }
    tags.push(raw);
    renderTagChips();
    document.getElementById("tagTextInput").focus();
  }

  document.getElementById("tagTextInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTagFromInput();
    } else if (e.key === "Backspace" && e.target.value === "" && tags.length) {
      tags = tags.slice(0, -1);
      renderTagChips();
    }
  });
  document.getElementById("tagTextInput").addEventListener("blur", () => {
    if (document.getElementById("tagTextInput").value.trim()) addTagFromInput();
  });

  document.getElementById("cancelBtn").onclick = closeSheet;

  document.getElementById("saveBtn").onclick = () => {
    const desc = document.getElementById("fDesc").value.trim();
    const amount = Number(document.getElementById("fAmount").value);
    const date = document.getElementById("fDate").value || today;
    const repeatsChecked = document.getElementById("fRepeats").checked;
    if (document.getElementById("tagTextInput").value.trim()) addTagFromInput();
    if (!amount || amount <= 0) {
      flashField("fAmount");
      return;
    }

    let saved;
    if (tx) {
      tx.desc = desc;
      tx.amount = amount;
      tx.category = chosenCat;
      tx.date = date;
      tx.tags = tags.length ? tags : undefined;
      saved = tx;

      if (repeatsChecked && !wasRecurring) {
        const rule = createRecurringRule({
          type,
          desc,
          amount,
          category: chosenCat,
          date,
        });
        saved.recurringId = rule.id;
      } else if (!repeatsChecked && wasRecurring) {
        stopRecurringRule(tx.recurringId);
        delete saved.recurringId;
      } else if (repeatsChecked && wasRecurring) {
        const rule = DATA.recurring.find((r) => r.id === tx.recurringId);
        if (rule)
          updateRecurringTemplate(rule, { desc, amount, category: chosenCat });
      }
    } else {
      saved = {
        id: uid(),
        type,
        desc,
        amount,
        category: chosenCat,
        date,
        tags: tags.length ? tags : undefined,
      };
      if (repeatsChecked) {
        const rule = createRecurringRule({
          type,
          desc,
          amount,
          category: chosenCat,
          date,
        });
        saved.recurringId = rule.id;
      }
      DATA.transactions.push(saved);
    }

    saveData();
    if (isCloudMode())
      cloudUpsertTransaction(saved).catch((e) => notifySyncError(e));
    closeSheet();
    onChange();
  };

  if (tx) {
    document.getElementById("deleteBtn").onclick = () => confirmDelete(tx);
  }
}

function flashField(id) {
  const el = document.getElementById(id);
  el.style.borderColor = "var(--coral)";
  setTimeout(() => {
    el.style.borderColor = "transparent";
  }, 700);
}

function confirmDelete(tx) {
  const isRecurring = !!tx.recurringId;
  openModal(`
    <div class="grabber"></div>
    <h3>Remove this entry?</h3>
    <p style="color:var(--ink-soft);font-size:13.5px;margin-top:-6px;">${
      isRecurring
        ? "This is a recurring entry — removing it also stops it from repeating next month."
        : "This can't be undone."
    }</p>
    <div class="sheet-actions" style="margin-top:18px;">
      <button class="btn btn-ghost" id="cancelDel">Keep it</button>
      <button class="btn btn-danger" id="confirmDel">${isRecurring ? "Remove & stop repeating" : "Remove"}</button>
    </div>
  `);
  document.getElementById("cancelDel").onclick = closeSheet;
  document.getElementById("confirmDel").onclick = () => {
    DATA.transactions = DATA.transactions.filter((t) => t.id !== tx.id);
    saveData();
    if (isCloudMode())
      cloudDeleteTransaction(tx.id).catch((e) => notifySyncError(e));
    if (isRecurring) stopRecurringRule(tx.recurringId);
    closeSheet();
    onChange();
  };
}
