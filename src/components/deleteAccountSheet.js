import { openModal, closeModal } from "./modal.js";
import { deleteMyAccountData } from "../auth.js";
import { getActiveHousehold } from "../household.js";
import { escapeHtml } from "../format.js";
import { requirePasswordConfirmation } from "./reauthSheet.js";

let onDone = () => {};

export function initDeleteAccountSheet(onDoneCallback) {
  onDone = onDoneCallback;
}

export function openDeleteAccountSheet() {
  requirePasswordConfirmation(() => render(), {
    title: "Confirm your password",
    message:
      "Deleting your account is permanent — confirm it's really you before continuing.",
  });
}

function render(message) {
  const household = getActiveHousehold();

  openModal(
    `
    <div class="grabber"></div>
    <h3>Delete your account?</h3>
    <p class="auth-message">This permanently erases every transaction, budget, bill, savings goal, and utang entry you own. Your sign-in itself may still exist afterward, but there will be nothing left in it.</p>
    ${household ? `<p class="auth-message" style="color:var(--coral);">You're in <strong>${escapeHtml(household.name)}</strong> — anything you personally added there disappears too. Other members keep what they added, but yours goes with you.</p>` : ""}
    <p class="auth-message" style="font-weight:700;">This can't be undone.</p>
    <div class="field">
      <label>Type DELETE to confirm</label>
      <input id="deleteConfirmInput" type="text" placeholder="DELETE" autocomplete="off"/>
    </div>
    ${message ? `<p class="auth-message" style="color:var(--coral);">${message}</p>` : ""}
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="deleteCancelBtn">Keep my account</button>
      <button class="btn btn-danger" id="deleteConfirmBtn">Delete everything</button>
    </div>
  `,
    closeModal,
  );

  document.getElementById("deleteCancelBtn").onclick = closeModal;

  document.getElementById("deleteConfirmBtn").onclick = async () => {
    const typed = document.getElementById("deleteConfirmInput").value.trim();
    if (typed !== "DELETE") {
      render("Type DELETE (all caps) in the box above to confirm.");
      return;
    }
    const btn = document.getElementById("deleteConfirmBtn");
    btn.disabled = true;
    btn.textContent = "Deleting…";
    try {
      await deleteMyAccountData();
      closeModal();
      onDone();
    } catch (e) {
      render(
        e.message ||
          "Something went wrong. Your data was not deleted — please try again.",
      );
    }
  };
}
