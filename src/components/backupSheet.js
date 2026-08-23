import { openModal, closeModal } from "./modal.js";
import { exportBackup, parseBackupFile, restoreBackup } from "../backup.js";

let onChange = () => {};

export function initBackupSheet(rerenderCallback) {
  onChange = rerenderCallback;
}

export function openBackupSheet() {
  render();
}

function render(message) {
  openModal(
    `
    <div class="grabber"></div>
    <h3>Backup & restore</h3>
    <p class="auth-message">A full backup includes everything — transactions, budgets, bills, goals, and utang — in a format Kwenta itself can read back in. This is different from the CSV export, which is for viewing in a spreadsheet, not restoring.</p>

    <div class="profile-card" style="margin-bottom:12px;">
      <div class="profile-row">
        <div>
          <div class="profile-label">Export</div>
          <div class="profile-value">Download a full backup file</div>
        </div>
        <button class="btn btn-ghost variant-gold" id="backupExportBtn">Download</button>
      </div>
    </div>

    <div class="profile-card">
      <div class="profile-row">
        <div>
          <div class="profile-label">Restore</div>
          <div class="profile-value">Replace everything with a backup file</div>
        </div>
        <button class="btn btn-ghost" id="backupRestoreBtn">Choose file</button>
      </div>
    </div>
    <input type="file" id="backupFileInput" accept="application/json" style="display:none;"/>

    ${message ? `<p class="auth-message" style="color:var(--coral);margin-top:14px;">${message}</p>` : ""}
    <div class="sheet-actions" style="margin-top:14px;">
      <button class="btn btn-ghost" id="backupCloseBtn">Close</button>
    </div>
  `,
    closeModal,
  );

  document.getElementById("backupCloseBtn").onclick = closeModal;
  document.getElementById("backupExportBtn").onclick = exportBackup;

  const fileInput = document.getElementById("backupFileInput");
  document.getElementById("backupRestoreBtn").onclick = () => fileInput.click();

  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    fileInput.value = ""; // reset so picking the same file again still fires onchange
    if (!file) return;

    try {
      const backup = await parseBackupFile(file);
      renderConfirm(backup);
    } catch (e) {
      render(e.message || "Could not read that file.");
    }
  };
}

function renderConfirm(backup, error) {
  const count = (backup.data.transactions || []).length;
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
    <p class="auth-message">This backup is from <strong>${date}</strong> and contains <strong>${count} transaction${count === 1 ? "" : "s"}</strong>.</p>
    <p class="auth-message" style="color:var(--coral);font-weight:700;">Everything currently in Kwenta — all transactions, budgets, bills, goals, and utang — will be replaced with what's in this file. This can't be undone.</p>
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
