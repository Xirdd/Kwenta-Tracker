import "./shareIntakeSheet.css";
import { DATA, saveData } from "../state.js";
import { allExpenseCategories, categoryIconBadge } from "../categories.js";
import { uid, escapeHtml } from "../format.js";
import { openModal, closeModal } from "./modal.js";
import { isCloudMode, cloudUpsertTransaction } from "../sync.js";
import { notifySyncError } from "../toast.js";
import { extractAmount } from "../shareParse.js";

let onChange = () => {};

export function initShareIntakeSheet(rerenderCallback) {
  onChange = rerenderCallback;
}

const SHARE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>`;

// Called from main.js once, right after takePendingShare() finds something
// waiting. `share` is { title, text, url, file, receivedAt }, exactly what
// shareStore.js stored.
export function openShareIntakeSheet(share) {
  const cats = allExpenseCategories();
  const guessedAmount = extractAmount(share.text) || extractAmount(share.title);
  const photoUrl = share.file ? URL.createObjectURL(share.file) : null;
  const today = new Date().toISOString().slice(0, 10);

  openModal(
    `
    <div class="grabber"></div>
    <h3>Add from your share</h3>
    <div class="share-intake-source">${SHARE_ICON}<span>Shared from another app${share.title ? ` · ${escapeHtml(share.title)}` : ""}</span></div>
    ${photoUrl ? `<img src="${photoUrl}" class="share-intake-photo" alt="Shared image"/>` : ""}
    ${
      guessedAmount
        ? `<div class="share-intake-detected">Found ${escapeHtml(String(guessedAmount))} in the shared text — filled in below</div>`
        : ""
    }
    <div class="field">
      <label>Description</label>
      <input id="siDesc" type="text" placeholder="What was this for?" value="${escapeHtml((share.text || "").slice(0, 80))}"/>
    </div>
    <div class="field amount">
      <label>Amount</label>
      <input id="siAmount" type="number" inputmode="decimal" placeholder="0.00" value="${guessedAmount || ""}"/>
    </div>
    <div class="field">
      <label>Category</label>
      <div class="cat-grid" id="siCatGrid">
        ${cats.map((c, i) => `<div class="cat-opt ${i === 0 ? "selected" : ""}" data-cat="${c.id}">${categoryIconBadge(c, 32)}${c.label}</div>`).join("")}
      </div>
    </div>
    <div class="field">
      <label>Date</label>
      <input id="siDate" type="date" value="${today}"/>
    </div>
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="siDiscardBtn">Discard</button>
      <button class="btn btn-primary" id="siSaveBtn">Save expense</button>
    </div>
    ${
      photoUrl
        ? `<p class="field-hint" style="text-align:center;margin-top:12px;">The photo is only shown here to help you fill this in — it isn't saved with the expense.</p>`
        : ""
    }
  `,
    () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      closeModal();
    },
  );

  let chosenCat = cats[0].id;
  document.querySelectorAll("#siCatGrid .cat-opt").forEach((el) => {
    el.onclick = () => {
      chosenCat = el.dataset.cat;
      document
        .querySelectorAll("#siCatGrid .cat-opt")
        .forEach((o) => o.classList.remove("selected"));
      el.classList.add("selected");
    };
  });

  const cleanup = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  };

  document.getElementById("siDiscardBtn").onclick = () => {
    cleanup();
    closeModal();
  };

  document.getElementById("siSaveBtn").onclick = () => {
    const amount = Number(document.getElementById("siAmount").value);
    if (!amount || amount <= 0) {
      const el = document.getElementById("siAmount");
      el.style.borderColor = "var(--coral)";
      setTimeout(() => {
        el.style.borderColor = "transparent";
      }, 700);
      return;
    }
    const tx = {
      id: uid(),
      type: "expense",
      desc: document.getElementById("siDesc").value.trim(),
      amount,
      category: chosenCat,
      date: document.getElementById("siDate").value || today,
    };
    DATA.transactions.push(tx);
    saveData();
    if (isCloudMode())
      cloudUpsertTransaction(tx).catch((e) => notifySyncError(e));
    cleanup();
    closeModal();
    onChange();
  };
}
