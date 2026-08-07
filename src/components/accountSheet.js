import { openModal, closeModal } from "./modal.js";
import { escapeHtml } from "../format.js";
import { signOut } from "../auth.js";
import { getActiveHousehold } from "../household.js";
import { openHouseholdSheet } from "./householdSheet.js";

export function openAccountSheet(user) {
  const household = getActiveHousehold();

  openModal(`
    <div class="grabber"></div>
    <h3>Your account</h3>
    <p class="account-email">${user.email}</p>
    <p class="auth-message">Your ledger is synced to this account and available on any device you sign in on.</p>

    <div class="field">
      <label>Household</label>
      <p class="field-hint" style="margin-bottom:10px;">${household ? `Sharing a budget with ${escapeHtml(household.name)}.` : "You're on a personal ledger — no one else can see it."}</p>
      <button class="btn btn-ghost" id="accountHouseholdBtn" style="width:100%;">${household ? "Manage household" : "Share your budget"}</button>
    </div>

    <div class="sheet-actions" style="margin-top:14px;">
      <button class="btn btn-ghost" id="accountCancelBtn">Close</button>
      <button class="btn btn-danger" id="accountSignOutBtn">Sign out</button>
    </div>
  `);
  document.getElementById("accountCancelBtn").onclick = closeModal;
  document.getElementById("accountHouseholdBtn").onclick = openHouseholdSheet;
  document.getElementById("accountSignOutBtn").onclick = async () => {
    await signOut();
    closeModal(); // onAuthChange will re-render the app and fall back to local data
  };
}
