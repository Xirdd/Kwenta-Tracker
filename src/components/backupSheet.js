import { openModal, closeModal } from "./modal.js";
import {
  exportBackup,
  parseBackupFile,
  isEncryptedBackup,
  unlockBackup,
  restoreBackup,
} from "../backup.js";
import { DATA } from "../state.js";

let onChange = () => {};

export function initBackupSheet(rerenderCallback) {
  onChange = rerenderCallback;
}

export function openBackupSheet() {
  render();
}

const MIN_PASSWORD_LENGTH = 8;

function render(message, isError = true) {
  openModal(
    `
    <div class="grabber"></div>
    <h3>Backup & restore</h3>
    <p class="auth-message">A full backup includes everything — transactions, budgets, bills, goals, and utang — in a format Kwenta itself can read back in. This is different from the CSV export, which is for viewing in a spreadsheet, not restoring.</p>

    <div class="profile-card" style="margin-bottom:12px;">
      <div class="profile-label" style="margin-bottom:10px;">Export</div>
      <div class="field" style="margin-bottom:10px;">
        <label>Password <span class="opt">(optional — leave blank for an unprotected file)</span></label>
        <input id="backupPassword" type="password" autocomplete="new-password" placeholder="At least ${MIN_PASSWORD_LENGTH} characters"/>
      </div>
      <div class="field" id="backupConfirmField" style="margin-bottom:10px;display:none;">
        <label>Confirm password</label>
        <input id="backupPasswordConfirm" type="password" autocomplete="new-password" placeholder="Type it again"/>
        <p class="field-hint" style="color:var(--coral);">Kwenta never stores this password and can't recover it. Forget it and this file can't be opened — by you or anyone.</p>
      </div>
      <button class="btn btn-ghost variant-gold" id="backupExportBtn" style="width:100%;">Download backup</button>
    </div>

    <div class="profile-card">
      <div class="profile-row">
        <div class="profile-row-text">
          <div class="profile-label">Restore</div>
          <div class="profile-value">Replace everything with a backup file</div>
        </div>
        <button class="btn btn-ghost" id="backupRestoreBtn">Choose file</button>
      </div>
    </div>
    <input type="file" id="backupFileInput" accept="application/json,.json" style="display:none;"/>

    ${message ? `<p class="auth-message" style="${isError ? "color:var(--coral);" : "color:var(--green);"}margin-top:14px;">${message}</p>` : ""}
    <div class="sheet-actions" style="margin-top:14px;">
      <button class="btn btn-ghost" id="backupCloseBtn">Close</button>
    </div>
  `,
    closeModal,
  );

  document.getElementById("backupCloseBtn").onclick = closeModal;

  // The confirm box only appears once a password is being typed — most
  // people exporting an ordinary backup never see it.
  const pw = document.getElementById("backupPassword");
  const confirmField = document.getElementById("backupConfirmField");
  pw.oninput = () => {
    confirmField.style.display = pw.value ? "block" : "none";
  };

  document.getElementById("backupExportBtn").onclick = async () => {
    const password = pw.value;
    if (password) {
      if (password.length < MIN_PASSWORD_LENGTH) {
        render(
          `Use at least ${MIN_PASSWORD_LENGTH} characters for the password.`,
        );
        return;
      }
      if (password !== document.getElementById("backupPasswordConfirm").value) {
        render("Those two passwords don't match — type them again.");
        return;
      }
    }
    const btn = document.getElementById("backupExportBtn");
    btn.disabled = true;
    btn.textContent = password ? "Encrypting…" : "Preparing…";
    try {
      await exportBackup(password || undefined);
      render(
        password
          ? "Encrypted backup downloaded. Keep the password somewhere safe — it can't be recovered."
          : "Backup downloaded.",
        false,
      );
    } catch (e) {
      render(e.message || "Couldn't create the backup. Please try again.");
    }
  };

  const fileInput = document.getElementById("backupFileInput");
  document.getElementById("backupRestoreBtn").onclick = () => fileInput.click();

  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    fileInput.value = ""; // reset so picking the same file again still fires onchange
    if (!file) return;

    try {
      const parsed = await parseBackupFile(file);
      if (isEncryptedBackup(parsed)) renderUnlock(parsed);
      else renderConfirm(parsed);
    } catch (e) {
      render(e.message || "Could not read that file.");
    }
  };
}

// An encrypted file needs its password before anything else can happen —
// including the diff preview, which has to read what's inside.
function renderUnlock(envelope, error) {
  openModal(
    `
    <div class="grabber"></div>
    <h3>This backup is locked</h3>
    <p class="auth-message">Enter the password you set when you exported it.</p>
    <div class="field">
      <label>Password</label>
      <input id="unlockPassword" type="password" autocomplete="off" placeholder="Backup password"/>
    </div>
    ${error ? `<p class="auth-message" style="color:var(--coral);">${error}</p>` : ""}
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="unlockCancelBtn">Cancel</button>
      <button class="btn btn-primary" id="unlockBtn">Unlock</button>
    </div>
  `,
    closeModal,
  );

  const input = document.getElementById("unlockPassword");
  input.focus();
  document.getElementById("unlockCancelBtn").onclick = () => render();

  document.getElementById("unlockBtn").onclick = async () => {
    if (!input.value) {
      renderUnlock(envelope, "Enter the backup's password.");
      return;
    }
    const btn = document.getElementById("unlockBtn");
    btn.disabled = true;
    btn.textContent = "Unlocking…";
    try {
      const backup = await unlockBackup(envelope, input.value);
      renderConfirm(backup);
    } catch (e) {
      renderUnlock(envelope, e.message);
    }
  };
}

// Counts the things a person actually cares about seeing change — not just
// "25 transactions" in isolation, but what that means relative to what's
// already here right now. Budgets are counted as "categories with a limit
// set" rather than a raw object size, since that's what the number means to
// a person reading it.
function summarize(data) {
  return {
    transactions: (data.transactions || []).length,
    budgetedCategories: Object.keys(data.budgets || {}).filter(
      (k) => data.budgets[k] != null && data.budgets[k] !== "",
    ).length,
    bills: (data.bills || []).length,
    goals: (data.goals || []).length,
    loans: (data.loans || []).length,
  };
}

function diffRow(label, before, after) {
  const changed = before !== after;
  return `
  <div class="backup-diff-row">
    <span class="backup-diff-label">${label}</span>
    <span class="backup-diff-values ${changed ? "changed" : ""}">
      ${before} <span class="backup-diff-arrow">→</span> ${after}
    </span>
  </div>`;
}

function renderConfirm(backup, error) {
  const before = summarize(DATA);
  const after = summarize(backup.data || {});
  const date = backup.exportedAt
    ? new Date(backup.exportedAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "an unknown date";

  openModal(
    `
    <div class="grabber"></div>
    <h3>Restore this backup?</h3>
    <p class="auth-message">This backup is from <strong>${date}</strong>.</p>

    <div class="backup-diff-card">
      ${diffRow("Transactions", before.transactions, after.transactions)}
      ${diffRow("Budgeted categories", before.budgetedCategories, after.budgetedCategories)}
      ${diffRow("Bills", before.bills, after.bills)}
      ${diffRow("Goals", before.goals, after.goals)}
      ${diffRow("Utang entries", before.loans, after.loans)}
    </div>

    <p class="auth-message" style="color:var(--coral);font-weight:700;margin-top:14px;">Everything currently in Kwenta — all transactions, budgets, bills, goals, and utang — will be replaced with what's in this file. This can't be undone.</p>
    <div class="field">
      <label>Type RESTORE to confirm</label>
      <input id="restoreConfirmInput" type="text" placeholder="RESTORE" autocomplete="off"/>
    </div>
    ${error ? `<p class="auth-message" style="color:var(--coral);">${error}</p>` : ""}
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="restoreCancelBtn">Cancel</button>
      <button class="btn btn-danger" id="restoreConfirmBtn">Restore</button>
    </div>
  `,
    closeModal,
  );

  document.getElementById("restoreCancelBtn").onclick = closeModal;

  document.getElementById("restoreConfirmBtn").onclick = async () => {
    const typed = document.getElementById("restoreConfirmInput").value.trim();
    if (typed !== "RESTORE") {
      renderConfirm(
        backup,
        "Type RESTORE (all caps) in the box above to confirm.",
      );
      return;
    }
    const btn = document.getElementById("restoreConfirmBtn");
    btn.disabled = true;
    btn.textContent = "Restoring…";
    try {
      await restoreBackup(backup);
      closeModal();
      onChange();
    } catch (e) {
      renderConfirm(
        backup,
        e.message ||
          "Something went wrong restoring this backup. Please try again.",
      );
    }
  };
}
