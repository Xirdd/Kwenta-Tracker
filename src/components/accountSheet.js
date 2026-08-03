import { openModal, closeModal } from "./modal.js";
import { signOut } from "../auth.js";

export function openAccountSheet(user) {
  openModal(`
    <div class="grabber"></div>
    <h3>Your account</h3>
    <p class="account-email">${user.email}</p>
    <p class="auth-message">Your ledger is synced to this account and available on any device you sign in on.</p>
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="accountCancelBtn">Close</button>
      <button class="btn btn-danger" id="accountSignOutBtn">Sign out</button>
    </div>
  `);
  document.getElementById("accountCancelBtn").onclick = closeModal;
  document.getElementById("accountSignOutBtn").onclick = async () => {
    await signOut();
    closeModal(); // onAuthChange will re-render the app and fall back to local data
  };
}
