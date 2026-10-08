import "./profilePage.css";
import { getCurrentUser, getUserProfile } from "../auth.js";
import { getActiveHousehold, isHouseholdOwner } from "../household.js";
import { DATA, state } from "../state.js";
import { escapeHtml } from "../format.js";
import {
  getAvatarUrl,
  hasAvatar,
  uploadAvatar,
  removeAvatar,
} from "../avatar.js";
import { showToast } from "../toast.js";
import { openEditProfileSheet } from "./editProfileSheet.js";
import { openHouseholdSheet } from "./householdSheet.js";

// The Profile page — who you are. Reached from the person icon in the header
// (next to Search). App behaviour (theme, security, data…) lives under the
// bottom-nav Settings tab instead.

// Kwenta has no paid plans, so this is a fixed label for now. When billing
// exists, derive it from the account instead.
const ACCOUNT_TIER = "Free";

let onChange = () => {};

export function initProfilePage(rerenderCallback) {
  onChange = rerenderCallback;
}

const BACK_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>`;
const CAMERA_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
const CHEVRON_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

function initialOf(name, email) {
  const source = (name || "").trim() || email || "";
  return source.trim().charAt(0).toUpperCase() || "?";
}

function ageFromBirthday(birthday) {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (Number.isNaN(b.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const before =
    today.getMonth() < b.getMonth() ||
    (today.getMonth() === b.getMonth() && today.getDate() < b.getDate());
  if (before) age--;
  return age;
}

function formatBirthday(birthday) {
  const b = new Date(birthday);
  if (Number.isNaN(b.getTime())) return "";
  const text = b.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const age = ageFromBirthday(birthday);
  return age !== null ? `${text} · ${age}` : text;
}

function memberSince(user) {
  const d = new Date(user.created_at);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// A row in the Details card. `tap` makes it a button (with a chevron); without
// it the row is read-only.
function detailRow({ id, label, value, tap, placeholder }) {
  const content = `
    <div class="settings-row-text">
      <div class="settings-row-label">${label}</div>
    </div>
    <div class="settings-row-end" ${placeholder ? 'style="font-weight:500;opacity:.7;"' : ""}>${value}</div>`;
  return tap
    ? `<div class="settings-row" id="${id}" role="button" tabindex="0">${content}<span class="settings-row-chevron">${CHEVRON_ICON}</span></div>`
    : `<div class="settings-row static">${content}</div>`;
}

export function renderProfilePage() {
  const user = getCurrentUser();
  if (!user) return ""; // the auth gate never lets a signed-out visitor reach this

  const { fullName, birthday } = getUserProfile();
  const household = getActiveHousehold();
  const url = getAvatarUrl();
  const initial = escapeHtml(initialOf(fullName, user.email));

  const accountType = household
    ? `${escapeHtml(household.name)} · ${isHouseholdOwner() ? "Owner" : "Member"}`
    : "Personal ledger";

  return `
  <div class="pp-top">
    <button type="button" class="pp-back" id="ppBackBtn" aria-label="Back to Overview">${BACK_ICON}<span>Back</span></button>
    <div class="section-title">Profile</div>
  </div>

  <div class="pp-hero">
    <button type="button" class="pp-avatar-btn" id="ppAvatarBtn" aria-label="Change profile photo">
      <span class="pp-avatar">
        <span aria-hidden="true">${initial}</span>
        ${url ? `<img data-avatar src="${escapeHtml(url)}" alt="Your profile photo" decoding="async"/>` : ""}
      </span>
      <span class="pp-camera" aria-hidden="true">${CAMERA_ICON}</span>
    </button>
    <div class="pp-name ${fullName ? "" : "placeholder"}">${fullName ? escapeHtml(fullName) : "Add your name"}</div>
    <div class="pp-email">${escapeHtml(user.email)}</div>
    <span class="pp-tier">${escapeHtml(ACCOUNT_TIER)} plan</span>
    <div class="pp-hero-actions">
      <button type="button" class="btn btn-ghost" id="ppEditBtn">Edit profile</button>
      ${hasAvatar() ? `<button type="button" class="btn btn-ghost btn-quiet" id="ppRemovePhotoBtn">Remove photo</button>` : ""}
    </div>
    <input type="file" id="ppFileInput" accept="image/*" hidden/>
  </div>

  <div class="pp-stats">
    <div class="pp-stat"><div class="value">${DATA.transactions.length}</div><div class="label">Entries</div></div>
    <div class="pp-stat"><div class="value">${DATA.goals.length}</div><div class="label">Goals</div></div>
    <div class="pp-stat"><div class="value">${DATA.bills.length}</div><div class="label">Bills</div></div>
  </div>

  <div class="settings-section-label">Details</div>
  <div class="settings-card">
    ${detailRow({
      id: "ppNameRow",
      label: "Name",
      value: fullName ? escapeHtml(fullName) : "Not set",
      placeholder: !fullName,
      tap: true,
    })}
    ${detailRow({ label: "Email", value: escapeHtml(user.email) })}
    ${detailRow({
      id: "ppBirthdayRow",
      label: "Birthday",
      value: birthday ? escapeHtml(formatBirthday(birthday)) : "Not set",
      placeholder: !birthday,
      tap: true,
    })}
    ${detailRow({ label: "Member since", value: escapeHtml(memberSince(user)) })}
  </div>

  <div class="settings-section-label">Account</div>
  <div class="settings-card">
    ${detailRow({ label: "Plan", value: `${escapeHtml(ACCOUNT_TIER)}` })}
    ${detailRow({
      id: "ppHouseholdRow",
      label: "Household",
      value: accountType,
      tap: true,
    })}
  </div>
  <p class="field-hint" style="margin:10px 6px 0 6px;">Password, two-factor, App Lock and the rest are under <strong>Settings</strong>.</p>
  `;
}

function activate(id, handler) {
  const el = document.getElementById(id);
  if (!el) return;
  el.onclick = handler;
  el.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handler();
    }
  };
}

export function attachProfilePageEvents() {
  const back = document.getElementById("ppBackBtn");
  if (back) {
    back.onclick = () => {
      state.section = "overview";
      onChange();
    };
  }

  activate("ppEditBtn", openEditProfileSheet);
  activate("ppNameRow", openEditProfileSheet);
  activate("ppBirthdayRow", openEditProfileSheet);
  activate("ppHouseholdRow", openHouseholdSheet);

  const avatarBtn = document.getElementById("ppAvatarBtn");
  const fileInput = document.getElementById("ppFileInput");
  if (avatarBtn && fileInput) {
    avatarBtn.onclick = () => fileInput.click();
    fileInput.onchange = async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = ""; // so choosing the same photo again still fires
      if (!file) return;
      avatarBtn.classList.add("busy");
      showToast("Uploading photo…", { duration: 8000 });
      try {
        await uploadAvatar(file);
        showToast("Profile photo updated.");
        onChange();
      } catch (e) {
        avatarBtn.classList.remove("busy");
        showToast(e.message || "Couldn't upload that photo.", {
          duration: 6000,
        });
      }
    };
  }

  const removeBtn = document.getElementById("ppRemovePhotoBtn");
  if (removeBtn) {
    removeBtn.onclick = async () => {
      removeBtn.disabled = true;
      try {
        await removeAvatar();
        showToast("Profile photo removed.");
        onChange();
      } catch (e) {
        removeBtn.disabled = false;
        showToast(e.message || "Couldn't remove the photo.", {
          duration: 6000,
        });
      }
    };
  }
}
