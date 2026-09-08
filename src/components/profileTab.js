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
const TRASH_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
const CHEVRON_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

// A normal settings row: icon-less label/value on the left (wrapped so long
// text — an email, a household name — truncates/wraps instead of squeezing
// the button on the right), an optional action button on the right.
function settingsRow({ id, label, value, buttonLabel, buttonClass = "" }) {
  return `
  <div class="profile-card">
    <div class="profile-row">
      <div class="profile-row-text">
        <div class="profile-label">${label}</div>
        <div class="profile-value">${value}</div>
      </div>
      ${buttonLabel ? `<button class="btn btn-ghost ${buttonClass}" id="${id}">${buttonLabel}</button>` : ""}
    </div>
  </div>`;
}

export function renderProfileTab() {
  const user = getCurrentUser();
  const household = getActiveHousehold();
  const theme = currentTheme();

  return `
  <div class="section-title">Profile</div>

  ${
    user
      ? settingsRow({ label: "Account", value: escapeHtml(user.email) })
      : `
  <div class="profile-card">
    <div class="profile-row">
      <div class="profile-row-text">
        <div class="profile-label">Account</div>
        <div class="profile-value">Not signed in</div>
      </div>
      <button class="btn btn-ghost variant-green" id="profileAuthBtn">Sign in</button>
    </div>
  </div>`
  }

  ${
    user
      ? `
  ${settingsRow({
    id: "profileHouseholdBtn",
    label: "Household",
    value: household
      ? escapeHtml(household.name)
      : "Personal ledger — nothing shared",
    buttonLabel: household ? "Manage" : "Share budget",
    buttonClass: household ? "" : "variant-green",
  })}
  ${settingsRow({
    id: "profilePasswordBtn",
    label: "Password",
    value: "Sign in without waiting on a magic link",
    buttonLabel: "Change",
  })}
  ${settingsRow({
    id: "profileDevicesBtn",
    label: "Devices",
    value: "See where you're signed in",
    buttonLabel: "View",
  })}
  ${settingsRow({
    id: "profileMfaBtn",
    label: "Two-factor authentication",
    value: "Add a code from an authenticator app",
    buttonLabel: "Manage",
  })}
  ${settingsRow({
    id: "profileNotificationsBtn",
    label: "Notifications",
    value: "Bill reminders and budget alerts",
    buttonLabel: "Manage",
  })}
  `
      : `
  <div class="profile-card">
    <div class="profile-value" style="font-weight:500;color:var(--ink-soft);">Sign in above to share a household budget or set a password.</div>
  </div>
  `
  }

  <div class="profile-card">
    <div class="profile-label" style="margin-bottom:12px;">Appearance</div>
    ${renderThemeGroup("Light", theme)}
    ${renderThemeGroup("Dark", theme)}
  </div>

  ${settingsRow({
    id: "profileExportBtn",
    label: "Export",
    value: "Download everything as a CSV file",
    buttonLabel: "Export",
    buttonClass: "variant-gold",
  })}
  ${settingsRow({
    id: "profileBackupBtn",
    label: "Backup",
    value: "Full backup you can restore from later",
    buttonLabel: "Manage",
    buttonClass: "variant-gold",
  })}

  ${
    user
      ? `
  <button class="signout-btn" id="profileSignOutBtn">${SIGNOUT_ICON}<span>Sign out</span></button>

  <div class="profile-card danger-card" id="profileDeleteBtn">
    <div class="profile-row">
      <div class="danger-row-left">
        <span class="danger-icon">${TRASH_ICON}</span>
        <div class="profile-row-text">
          <div class="profile-label" style="color:var(--coral);">Danger zone</div>
          <div class="profile-value" style="color:var(--coral);">Delete my account</div>
        </div>
      </div>
      <span class="danger-chevron">${CHEVRON_ICON}</span>
    </div>
  </div>
  `
      : ""
  }

  <div class="made-by-credit">Made by <span>Chadrix</span></div>
  `;
}

// Renders one labeled group ("Light" or "Dark") with only the themes that
// belong to it — kept as two clearly separate rows rather than one mixed
// row, so it's never ambiguous which mode a swatch actually is.
function renderThemeGroup(groupLabel, activeTheme) {
  const mode = groupLabel.toLowerCase();
  const themes = THEMES.filter((t) => t.mode === mode);
  if (themes.length === 0) return "";

  return `
  <div class="theme-group">
    <div class="theme-group-label">${groupLabel}</div>
    <div class="theme-swatch-row">
      ${themes
        .map(
          (t) => `
        <button class="theme-swatch ${activeTheme === t.id ? "active" : ""}" data-theme-id="${t.id}" title="${t.label}">
          <span class="theme-swatch-circle" style="background:${t.bg};">
            <span class="theme-swatch-inner" style="background:${t.paper};"></span>
          </span>
          <span class="theme-swatch-label">${t.label}</span>
        </button>
      `,
        )
        .join("")}
    </div>
  </div>`;
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
