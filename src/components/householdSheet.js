import { openModal, closeModal } from "./modal.js";
import { escapeHtml } from "../format.js";
import {
  getActiveHousehold,
  isHouseholdOwner,
  createHousehold,
  joinHousehold,
  leaveHousehold,
  regenerateInviteCode,
  listHouseholdMembers,
  removeHouseholdMember,
} from "../household.js";
import { getCurrentUser } from "../auth.js";
import { openHouseholdActivitySheet } from "./householdActivitySheet.js";

let onChange = () => {};

export function initHouseholdSheet(rerenderCallback) {
  onChange = rerenderCallback;
}

export function openHouseholdSheet() {
  const household = getActiveHousehold();
  if (household) renderCurrent(household);
  else renderJoinOrCreate();
}

// "Expires in 6 days" / "Expires in 3 hours" / "Expired — generate a new code"
function expiryInfo(iso) {
  if (!iso) return { text: "", expired: false };
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { text: "Expired — generate a new code", expired: true };
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return { text: "Expires in under an hour", expired: false };
  if (hours < 48)
    return {
      text: `Expires in ${hours} hour${hours === 1 ? "" : "s"}`,
      expired: false,
    };
  return { text: `Expires in ${Math.floor(hours / 24)} days`, expired: false };
}

function renderCurrent(household, message) {
  const owner = isHouseholdOwner();
  const { text: expiryText, expired } = expiryInfo(household.inviteExpiresAt);

  openModal(`
    <div class="grabber"></div>
    <h3>${escapeHtml(household.name)}</h3>
    <p class="auth-message">Expenses, budgets, bills, goals, and utang are shared with everyone in this household. Your salary stays private, always.</p>
    <div class="field">
      <label>Invite code <span class="opt">(share this so someone else can join)</span></label>
      <div class="invite-code-box">
        <span id="inviteCodeText" style="${expired ? "opacity:.45;text-decoration:line-through;" : ""}">${escapeHtml(household.inviteCode)}</span>
        <button class="btn-copy" id="copyCodeBtn" ${expired ? "disabled" : ""}>Copy</button>
      </div>
      ${expiryText ? `<p class="field-hint" style="${expired ? "color:var(--coral);" : ""}">${escapeHtml(expiryText)}</p>` : ""}
      ${owner ? `<button class="btn btn-ghost" id="hRegenBtn" style="width:100%;margin-top:8px;">Generate new code</button>` : ""}
    </div>
    <div class="field">
      <label>Members</label>
      <div class="profile-card" style="margin:0;padding:6px 16px;" id="hMembers"><p class="field-hint" style="margin:10px 0;">Loading…</p></div>
    </div>
    ${message ? `<p class="auth-message">${escapeHtml(message)}</p>` : ""}
    <div class="sheet-actions" style="flex-direction:column;">
      <button class="btn btn-ghost" id="hActivityBtn">View activity</button>
      <button class="btn btn-ghost" id="hCloseBtn">Close</button>
      <button class="btn btn-danger" id="hLeaveBtn">Leave household</button>
    </div>
  `);

  document.getElementById("hActivityBtn").onclick = () =>
    openHouseholdActivitySheet(household.id);
  document.getElementById("hCloseBtn").onclick = closeModal;
  document.getElementById("hLeaveBtn").onclick = () =>
    renderConfirmLeave(household);

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

  const regenBtn = document.getElementById("hRegenBtn");
  if (regenBtn) {
    regenBtn.onclick = async () => {
      if (
        !window.confirm(
          "Generate a new code? The current one will stop working immediately. People already in the household stay in.",
        )
      )
        return;
      regenBtn.disabled = true;
      regenBtn.textContent = "Generating…";
      try {
        const updated = await regenerateInviteCode();
        renderCurrent(updated, "New code generated — valid for 7 days.");
      } catch (e) {
        renderCurrent(
          household,
          e.message || "Couldn't generate a new code. Try again.",
        );
      }
    };
  }

  loadMembers(household, owner);
}

async function loadMembers(household, owner) {
  const box = document.getElementById("hMembers");
  let members;
  try {
    members = await listHouseholdMembers();
  } catch (e) {
    if (box)
      box.innerHTML = `<p class="field-hint" style="margin:10px 0;color:var(--coral);">${escapeHtml(e.message || "Couldn't load members.")}</p>`;
    return;
  }
  // The sheet may have been closed or replaced while this was loading.
  const stillThere = document.getElementById("hMembers");
  if (!stillThere) return;

  const me = getCurrentUser();
  stillThere.innerHTML = members
    .map((m) => {
      const isMe = me && m.user_id === me.id;
      const canRemove = owner && !isMe;
      return `
      <div class="profile-row" style="padding:10px 0;border-bottom:1px solid var(--line-dark);">
        <div class="profile-row-text">
          <div class="profile-value">${escapeHtml(m.email)}${isMe ? " (you)" : ""}</div>
          ${m.is_owner ? `<div class="profile-label" style="margin:2px 0 0 0;">Owner</div>` : ""}
        </div>
        ${canRemove ? `<button class="btn btn-ghost" data-remove-member="${escapeHtml(m.user_id)}" data-email="${escapeHtml(m.email)}" style="color:var(--coral);">Remove</button>` : ""}
      </div>`;
    })
    .join("");

  stillThere.querySelectorAll("[data-remove-member]").forEach((btn) => {
    btn.onclick = async () => {
      const email = btn.dataset.email;
      if (
        !window.confirm(
          `Remove ${email}? They lose access to the household's shared data. Entries they added stay with the household.`,
        )
      )
        return;
      btn.disabled = true;
      btn.textContent = "Removing…";
      try {
        await removeHouseholdMember(btn.dataset.removeMember);
        renderCurrent(household, `${email} was removed.`);
      } catch (e) {
        renderCurrent(household, e.message || "Couldn't remove that member.");
      }
    };
  });
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
      <input id="hNewName" type="text" maxlength="60" placeholder="e.g. Dela Cruz Household"/>
    </div>
    <button class="btn btn-primary" id="hCreateBtn" style="width:100%;margin-bottom:18px;">Create household</button>

    <div class="field">
      <label>Or join one with a code</label>
      <input id="hJoinCode" type="text" placeholder="Invite code" maxlength="10" autocomplete="off" autocapitalize="characters" style="text-transform:uppercase;"/>
    </div>
    <button class="btn btn-ghost" id="hJoinBtn" style="width:100%;">Join household</button>

    ${message ? `<p class="auth-message" style="margin-top:14px;">${escapeHtml(message)}</p>` : ""}
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
      renderJoinOrCreate(e.message || "Couldn't join that household.");
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
