import { openModal, closeModal } from "./modal.js";
import { escapeHtml } from "../format.js";
import {
  getActiveHousehold,
  createHousehold,
  joinHousehold,
  leaveHousehold,
} from "../household.js";

let onChange = () => {};

export function initHouseholdSheet(rerenderCallback) {
  onChange = rerenderCallback;
}

export function openHouseholdSheet() {
  const household = getActiveHousehold();
  if (household) renderCurrent(household);
  else renderJoinOrCreate();
}

function renderCurrent(household, message) {
  openModal(`
    <div class="grabber"></div>
    <h3>${escapeHtml(household.name)}</h3>
    <p class="auth-message">Expenses, budgets, bills, goals, and utang are shared with everyone in this household. Your salary stays private, always.</p>
    <div class="field">
      <label>Invite code <span class="opt">(share this so someone else can join)</span></label>
      <div class="invite-code-box">
        <span id="inviteCodeText">${escapeHtml(household.inviteCode)}</span>
        <button class="btn-copy" id="copyCodeBtn">Copy</button>
      </div>
    </div>
    ${message ? `<p class="auth-message">${message}</p>` : ""}
    <div class="sheet-actions" style="flex-direction:column;">
      <button class="btn btn-ghost" id="hCloseBtn">Close</button>
      <button class="btn btn-danger" id="hLeaveBtn">Leave household</button>
    </div>
  `);

  document.getElementById("hCloseBtn").onclick = closeModal;

  document.getElementById("copyCodeBtn").onclick = async () => {
    try {
      await navigator.clipboard.writeText(household.inviteCode);
      renderCurrent(household, "Copied to clipboard.");
    } catch (e) {
      renderCurrent(
        household,
        `Couldn't copy automatically — the code is ${household.inviteCode}.`,
      );
    }
  };

  document.getElementById("hLeaveBtn").onclick = () =>
    renderConfirmLeave(household);
}

function renderConfirmLeave(household) {
  openModal(`
    <div class="grabber"></div>
    <h3>Leave ${escapeHtml(household.name)}?</h3>
    <p class="auth-message">You'll go back to a personal ledger. Shared data stays with the household for other members — you just won't see it anymore.</p>
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="hCancelLeaveBtn">Stay</button>
      <button class="btn btn-danger" id="hConfirmLeaveBtn">Leave</button>
    </div>
  `);
  document.getElementById("hCancelLeaveBtn").onclick = () =>
    renderCurrent(household);
  document.getElementById("hConfirmLeaveBtn").onclick = async () => {
    try {
      await leaveHousehold();
      closeModal();
      onChange();
    } catch (e) {
      renderCurrent(
        household,
        e.message || "Couldn't leave the household. Try again.",
      );
    }
  };
}

function renderJoinOrCreate(message) {
  openModal(`
    <div class="grabber"></div>
    <h3>Share your budget</h3>
    <p class="auth-message">Create a household to share expenses, budgets, bills, goals, and utang with someone — your salary always stays private.</p>

    <div class="field">
      <label>Create a new household</label>
      <input id="hNewName" type="text" placeholder="e.g. Dela Cruz Household"/>
    </div>
    <button class="btn btn-primary" id="hCreateBtn" style="width:100%;margin-bottom:18px;">Create household</button>

    <div class="field">
      <label>Or join one with a code</label>
      <input id="hJoinCode" type="text" placeholder="6-character code" maxlength="6" style="text-transform:uppercase;"/>
    </div>
    <button class="btn btn-ghost" id="hJoinBtn" style="width:100%;">Join household</button>

    ${message ? `<p class="auth-message" style="margin-top:14px;">${message}</p>` : ""}
  `);

  document.getElementById("hCreateBtn").onclick = async () => {
    const name = document.getElementById("hNewName").value.trim();
    if (!name) {
      flash("hNewName");
      return;
    }
    const btn = document.getElementById("hCreateBtn");
    btn.disabled = true;
    btn.textContent = "Creating…";
    try {
      await createHousehold(name);
      closeModal();
      onChange();
    } catch (e) {
      renderJoinOrCreate(
        e.message || "Could not create the household. Please try again.",
      );
    }
  };

  document.getElementById("hJoinBtn").onclick = async () => {
    const code = document.getElementById("hJoinCode").value.trim();
    if (!code) {
      flash("hJoinCode");
      return;
    }
    const btn = document.getElementById("hJoinBtn");
    btn.disabled = true;
    btn.textContent = "Joining…";
    try {
      await joinHousehold(code);
      closeModal();
      onChange();
    } catch (e) {
      renderJoinOrCreate(
        e.message || "Couldn't find a household with that code.",
      );
    }
  };
}

function flash(id) {
  const el = document.getElementById(id);
  el.style.borderColor = "var(--coral)";
  setTimeout(() => {
    el.style.borderColor = "transparent";
  }, 700);
}
