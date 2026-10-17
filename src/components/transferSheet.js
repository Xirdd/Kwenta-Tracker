import { escapeHtml, todayISO } from "../format.js";
import { openModal, closeModal } from "./modal.js";
import { flashField } from "../dom.js";
import { activeWallets, getWallet, createTransfer } from "../wallets.js";

let onChange = () => {};

export function initTransferSheet(rerenderCallback) {
  onChange = rerenderCallback;
}

export function openTransferForm() {
  const wallets = activeWallets();
  const today = todayISO();

  if (wallets.length < 2) {
    openModal(`
      <div class="grabber"></div>
      <h3>Transfer between wallets</h3>
      <p class="auth-message">You need at least two wallets to transfer between — add one more first.</p>
      <div class="sheet-actions">
        <button class="btn btn-ghost" id="xferCloseBtn">Close</button>
      </div>
    `);
    document.getElementById("xferCloseBtn").onclick = closeModal;
    return;
  }

  const walletOpts = (selectedId) =>
    wallets
      .map(
        (w) =>
          `<option value="${w.id}" ${w.id === selectedId ? "selected" : ""}>${escapeHtml(w.name)}</option>`,
      )
      .join("");

  openModal(`
    <div class="grabber"></div>
    <h3>Transfer between wallets</h3>
    <p class="auth-message">Moves money from one wallet to another — it isn't counted as income or an expense, so your totals and budgets stay accurate.</p>
    <div class="field">
      <label>From</label>
      <select id="xferFrom">${walletOpts(wallets[0].id)}</select>
    </div>
    <div class="field">
      <label>To</label>
      <select id="xferTo">${walletOpts(wallets[1]?.id)}</select>
    </div>
    <div class="field amount">
      <label>Amount</label>
      <input id="xferAmount" type="number" inputmode="decimal" placeholder="0.00"/>
    </div>
    <div class="field">
      <label>Date</label>
      <input id="xferDate" type="date" value="${today}"/>
    </div>
    <div class="field">
      <label>Note <span class="opt">(optional)</span></label>
      <input id="xferNote" type="text" placeholder="e.g. Moving savings to Maribank"/>
    </div>
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="xferCancelBtn">Cancel</button>
      <button class="btn btn-primary" id="xferSaveBtn">Transfer</button>
    </div>
  `);

  document.getElementById("xferCancelBtn").onclick = closeModal;

  document.getElementById("xferSaveBtn").onclick = () => {
    const fromId = document.getElementById("xferFrom").value;
    const toId = document.getElementById("xferTo").value;
    const amount = Number(document.getElementById("xferAmount").value);
    const date = document.getElementById("xferDate").value || today;
    const note = document.getElementById("xferNote").value.trim();

    if (fromId === toId) {
      flashField("xferTo");
      return;
    }
    if (!amount || amount <= 0) {
      flashField("xferAmount");
      return;
    }

    const result = createTransfer({
      fromWalletId: fromId,
      toWalletId: toId,
      amount,
      date,
      note,
    });
    if (!result) {
      flashField("xferAmount");
      return;
    }
    closeModal();
    onChange();
  };
}
