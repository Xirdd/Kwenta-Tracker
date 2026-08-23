import { getCurrentUser, signOut } from "../auth.js";
import { getActiveHousehold } from "../household.js";
import { currentTheme, setTheme, THEMES } from "../theme.js";
import { escapeHtml } from "../format.js";
import { exportCSV } from "../export.js";
import { openAuthSheet } from "./authSheet.js";
import { openHouseholdSheet } from "./householdSheet.js";
import { openSetPasswordSheet } from "./setPasswordSheet.js";
import { openDeleteAccountSheet } from "./deleteAccountSheet.js";
import { openDevicesSheet } from "./devicesSheet.js";
import { openMfaSetupSheet } from "./mfaSetupSheet.js";
import { openNotificationsSheet } from "./notificationsSheet.js";
import { openBackupSheet } from "./backupSheet.js";

let onChange = () => {};

export function initProfileTab(rerenderCallback) {
  onChange = rerenderCallback;
}

const SIGNOUT_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>`;

export function renderProfileTab() {
  const user = getCurrentUser();
  const household = getActiveHousehold();
  const theme = currentTheme();

  return `
  <div class="section-title">Profile</div>

  <div class="profile-card">
    <div class="profile-row">
      <div>
        <div class="profile-label">Account</div>
        <div class="profile-value">${user ? escapeHtml(user.email) : "Not signed in"}</div>
      </div>
      ${user ? "" : `<button class="btn btn-ghost variant-green" id="profileAuthBtn">Sign in</button>`}
    </div>
  </div>

  ${
    user
      ? `
  <div class="profile-card">
    <div class="profile-row">
      <div>
        <div class="profile-label">Household</div>
        <div class="profile-value">${household ? escapeHtml(household.name) : "Personal ledger — nothing shared"}</div>
      </div>
      <button class="btn btn-ghost ${household ? "" : "variant-green"}" id="profileHouseholdBtn">${household ? "Manage" : "Share budget"}</button>
    </div>
  </div>

  <div class="profile-card">
    <div class="profile-row">
      <div>
        <div class="profile-label">Password</div>
        <div class="profile-value">Sign in without waiting on a magic link</div>
      </div>
      <button class="btn btn-ghost" id="profilePasswordBtn">Change</button>
    </div>
  </div>

  <div class="profile-card">
    <div class="profile-row">
      <div>
        <div class="profile-label">Devices</div>
        <div class="profile-value">See where you're signed in</div>
      </div>
      <button class="btn btn-ghost" id="profileDevicesBtn">View</button>
    </div>
  </div>

  <div class="profile-card">
    <div class="profile-row">
      <div>
        <div class="profile-label">Two-factor authentication</div>
        <div class="profile-value">Add a code from an authenticator app</div>
      </div>
      <button class="btn btn-ghost" id="profileMfaBtn">Manage</button>
    </div>
  </div>

  <div class="profile-card">
    <div class="profile-row">
      <div>
        <div class="profile-label">Notifications</div>
        <div class="profile-value">Bill reminders and budget alerts</div>
      </div>
      <button class="btn btn-ghost" id="profileNotificationsBtn">Manage</button>
    </div>
  </div>
  `
      : `
  <div class="profile-card">
    <div class="profile-value" style="font-weight:500;color:var(--ink-soft);">Sign in above to share a household budget or set a password.</div>
  </div>
  `
  }

  <div class="profile-card">
    <div class="profile-label" style="margin-bottom:10px;">Appearance</div>
    <div class="theme-swatch-row">
      ${THEMES.map(
        (t) => `
        <button class="theme-swatch ${theme === t.id ? "active" : ""}" data-theme-id="${t.id}" title="${t.label}">
          <span class="theme-swatch-circle" style="background:${t.bg};">
            <span class="theme-swatch-inner" style="background:${t.paper};"></span>
          </span>
          <span class="theme-swatch-label">${t.label}</span>
        </button>
      `,
      ).join("")}
    </div>
  </div>

  <div class="profile-card">
    <div class="profile-row">
      <div>
        <div class="profile-label">Export</div>
        <div class="profile-value">Download everything as a CSV file</div>
      </div>
      <button class="btn btn-ghost variant-gold" id="profileExportBtn">Export</button>
    </div>
  </div>

  <div class="profile-card">
    <div class="profile-row">
      <div>
        <div class="profile-label">Backup</div>
        <div class="profile-value">Full backup you can restore from later</div>
      </div>
      <button class="btn btn-ghost variant-gold" id="profileBackupBtn">Manage</button>
    </div>
  </div>

  ${
    user
      ? `
  <button class="signout-btn" id="profileSignOutBtn">${SIGNOUT_ICON}<span>Sign out</span></button>
  <button class="delete-account-link" id="profileDeleteBtn">Delete my account</button>
  `
      : ""
  }
  `;
}

export function attachProfileEvents() {
  const authBtn = document.getElementById("profileAuthBtn");
  if (authBtn) authBtn.onclick = openAuthSheet;

  const signOutBtn = document.getElementById("profileSignOutBtn");
  if (signOutBtn) {
    signOutBtn.onclick = async () => {
      await signOut(); // onAuthChange (main.js) handles the re-render + falling back to local data
    };
  }

  const deleteBtn = document.getElementById("profileDeleteBtn");
  if (deleteBtn) deleteBtn.onclick = openDeleteAccountSheet;

  const householdBtn = document.getElementById("profileHouseholdBtn");
  if (householdBtn) householdBtn.onclick = openHouseholdSheet;

  const passwordBtn = document.getElementById("profilePasswordBtn");
  if (passwordBtn)
    passwordBtn.onclick = () => openSetPasswordSheet({ context: "manual" });

  const devicesBtn = document.getElementById("profileDevicesBtn");
  if (devicesBtn) devicesBtn.onclick = openDevicesSheet;

  const mfaBtn = document.getElementById("profileMfaBtn");
  if (mfaBtn) mfaBtn.onclick = openMfaSetupSheet;

  const notificationsBtn = document.getElementById("profileNotificationsBtn");
  if (notificationsBtn) notificationsBtn.onclick = openNotificationsSheet;

  const themeSwatches = document.querySelectorAll(".theme-swatch");
  themeSwatches.forEach((btn) => {
    btn.onclick = () => {
      setTheme(btn.dataset.themeId);
      onChange();
    };
  });

  const exportBtn = document.getElementById("profileExportBtn");
  if (exportBtn) exportBtn.onclick = exportCSV;

  const backupBtn = document.getElementById("profileBackupBtn");
  if (backupBtn) backupBtn.onclick = openBackupSheet;
}
