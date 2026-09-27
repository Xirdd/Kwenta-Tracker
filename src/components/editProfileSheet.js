import { openModal, closeModal } from "./modal.js";
import { getUserProfile, updateUserProfile } from "../auth.js";
import { escapeHtml } from "../format.js";

let onChange = () => {};

export function initEditProfileSheet(rerenderCallback) {
  onChange = rerenderCallback;
}

export function openEditProfileSheet() {
  const { fullName, birthday } = getUserProfile();
  render(fullName, birthday);
}

function render(name, birthday, error) {
  openModal(`
    <div class="grabber"></div>
    <h3>Edit profile</h3>
    <div class="field">
      <label>Name</label>
      <input id="epName" type="text" placeholder="Your name" value="${escapeHtml(name || "")}"/>
    </div>
    <div class="field">
      <label>Birthday <span class="opt">(optional)</span></label>
      <input id="epBirthday" type="date" value="${escapeHtml(birthday || "")}"/>
    </div>
    ${error ? `<p class="auth-message" style="color:var(--coral);">${error}</p>` : ""}
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="epCancelBtn">Cancel</button>
      <button class="btn btn-primary" id="epSaveBtn">Save</button>
    </div>
  `);

  document.getElementById("epCancelBtn").onclick = closeModal;

  document.getElementById("epSaveBtn").onclick = async () => {
    const name = document.getElementById("epName").value.trim();
    const bday = document.getElementById("epBirthday").value;
    const btn = document.getElementById("epSaveBtn");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      await updateUserProfile({ fullName: name, birthday: bday });
      closeModal();
      onChange();
    } catch (e) {
      render(
        name,
        bday,
        e.message || "Couldn't save your profile. Please try again.",
      );
    }
  };
}
