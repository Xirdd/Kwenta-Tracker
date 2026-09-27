import "./profileSettings.css";
import { getCurrentUser, signOut, getUserProfile } from "../auth.js";
import { getActiveHousehold } from "../household.js";
import { currentTheme, setTheme, THEMES } from "../theme.js";
import { currentCurrencyId, setCurrency, CURRENCIES } from "../currency.js";
import { escapeHtml } from "../format.js";
import { exportCSV } from "../export.js";
import { exportMonthlyStatementPDF } from "../pdfExport.js";
import { openAuthSheet } from "./authSheet.js";
import { openHouseholdSheet } from "./householdSheet.js";
import { openSetPasswordSheet } from "./setPasswordSheet.js";
import { openDeleteAccountSheet } from "./deleteAccountSheet.js";
import { openDevicesSheet } from "./devicesSheet.js";
import { openMfaSetupSheet } from "./mfaSetupSheet.js";
import { openNotificationsSheet } from "./notificationsSheet.js";
import { openBackupSheet } from "./backupSheet.js";
import { openAppLockSheet } from "./appLockSheet.js";
import { openEditProfileSheet } from "./editProfileSheet.js";
import { isLockEnabled } from "../appLock.js";

let onChange = () => {};

export function initProfileTab(rerenderCallback) {
  onChange = rerenderCallback;
}

const SIGNOUT_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>`;
const TRASH_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
const CHEVRON_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

// Small icon set for the grouped settings rows below — 24x24 stroke glyphs,
// same visual language as categories.js's category icons.
const ROW_ICONS = {
  home: `<path d="M3 9.5 12 3l9 6.5"/><path d="M5 10v10h14V10"/>`,
  lock: `<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>`,
  devices: `<rect x="4" y="3" width="16" height="12" rx="1"/><path d="M2 19h20"/><path d="M9 19v2h6v-2"/>`,
  shield: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
  bell: `<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`,
  fingerprint: `<path d="M12 11c0 3-1 5-3 7"/><path d="M8 8a5 5 0 0 1 8 4c0 1.5-.3 3-1 4.5"/><path d="M5 6a9 9 0 0 1 14 7c0 1 0 3-.5 4.5"/><path d="M12 4a9 9 0 0 0-6.4 15.3"/><path d="M12 11a2 2 0 0 1 2 2c0 3.5-1.5 6-4 8"/>`,
  download: `<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>`,
  doc: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>`,
  archive: `<rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><line x1="10" y1="13" x2="14" y2="13"/>`,
};

function rowIcon(key) {
  return `<span class="settings-row-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ROW_ICONS[key]}</svg></span>`;
}

// One card per section, holding one or more tappable rows. `rows` is an
// array of { id, icon, label, value }; click handlers are wired later in
// attachProfileEvents() by each row's id, same as the rest of this file.
function settingsSection(label, rows) {
  if (rows.length === 0) return "";
  return `
  <div class="settings-section-label">${label}</div>
  <div class="settings-card">
    ${rows
      .map(
        (r) => `
      <div class="settings-row" id="${r.id}">
        ${rowIcon(r.icon)}
        <div class="settings-row-text">
          <div class="settings-row-label">${r.label}</div>
          ${r.value ? `<div class="settings-row-value">${r.value}</div>` : ""}
        </div>
        <span class="settings-row-chevron">${CHEVRON_ICON}</span>
      </div>
    `,
      )
      .join("")}
  </div>`;
}

function initials(name, email) {
  const source = (name || "").trim() || email || "";
  return source.trim().charAt(0).toUpperCase() || "?";
}

function ageFromBirthday(birthday) {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (Number.isNaN(b.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const beforeBirthdayThisYear =
    today.getMonth() < b.getMonth() ||
    (today.getMonth() === b.getMonth() && today.getDate() < b.getDate());
  if (beforeBirthdayThisYear) age--;
  return age;
}

function formatBirthday(birthday) {
  const b = new Date(birthday);
  if (Number.isNaN(b.getTime())) return "";
  return b.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function renderProfileHeader(user) {
  const { fullName, birthday } = getUserProfile();
  const age = ageFromBirthday(birthday);
  const subParts = [user.email];
  if (birthday)
    subParts.push(
      `${formatBirthday(birthday)}${age !== null ? ` · ${age}` : ""}`,
    );

  return `
  <div class="profile-header-card" id="profileHeaderCard">
    <div class="profile-avatar">${escapeHtml(initials(fullName, user.email))}</div>
    <div class="profile-header-text">
      <div class="profile-header-name ${fullName ? "" : "placeholder"}">${fullName ? escapeHtml(fullName) : "Add your name"}</div>
      <div class="profile-header-sub">${escapeHtml(subParts.join(" · "))}</div>
    </div>
    <span class="profile-header-chevron">${CHEVRON_ICON}</span>
  </div>`;
}

export function renderProfileTab() {
  const user = getCurrentUser();
  const household = getActiveHousehold();
  const theme = currentTheme();

  if (!user) {
    return `
    <div class="section-title">Profile</div>
    <div class="profile-card">
      <div class="profile-row">
        <div class="profile-row-text">
          <div class="profile-label">Account</div>
          <div class="profile-value">Not signed in</div>
        </div>
        <button class="btn btn-ghost variant-green" id="profileAuthBtn">Sign in</button>
      </div>
    </div>
    <div class="profile-card">
      <div class="profile-value" style="font-weight:500;color:var(--ink-soft);">Sign in to edit your profile, share a household budget, or set a password.</div>
    </div>

    <div class="settings-section-label">Preferences</div>
    <div class="profile-card">
      <div class="profile-label" style="margin-bottom:12px;">Appearance</div>
      ${renderThemeGroup("Light", theme)}
      ${renderThemeGroup("Dark", theme)}
    </div>
    <div class="profile-card">
      <div class="profile-label" style="margin-bottom:4px;">Currency</div>
      <div class="profile-value" style="font-weight:500;color:var(--ink-soft);margin-bottom:12px;font-size:12px;">Changes how amounts are displayed only — doesn't convert anything.</div>
      ${renderCurrencyChips()}
    </div>

    ${settingsSection("Data", [
      {
        id: "profileExportBtn",
        icon: "download",
        label: "Export",
        value: "Download everything as a CSV file",
      },
      {
        id: "profileStatementBtn",
        icon: "doc",
        label: "Statement",
        value: "A shareable PDF summary for the current month",
      },
      {
        id: "profileBackupBtn",
        icon: "archive",
        label: "Backup",
        value: "Full backup you can restore from later",
      },
    ])}

    <div class="made-by-credit">Made by <span>Chadrix</span></div>
    `;
  }

  return `
  <div class="section-title">Profile</div>

  ${renderProfileHeader(user)}

  ${settingsSection("Account", [
    {
      id: "profileHouseholdBtn",
      icon: "home",
      label: "Household",
      value: household
        ? escapeHtml(household.name)
        : "Personal ledger — nothing shared",
    },
  ])}

  ${settingsSection("Security", [
    {
      id: "profilePasswordBtn",
      icon: "lock",
      label: "Password",
      value: "Sign in without waiting on a magic link",
    },
    {
      id: "profileMfaBtn",
      icon: "shield",
      label: "Two-factor authentication",
      value: "Add a code from an authenticator app",
    },
    {
      id: "profileAppLockBtn",
      icon: "fingerprint",
      label: "App Lock",
      value: isLockEnabled()
        ? "On for this device"
        : "Require a PIN to open Kwenta",
    },
    {
      id: "profileDevicesBtn",
      icon: "devices",
      label: "Devices",
      value: "See where you're signed in",
    },
  ])}

  ${settingsSection("Notifications", [
    {
      id: "profileNotificationsBtn",
      icon: "bell",
      label: "Notifications",
      value: "Bill reminders and budget alerts",
    },
  ])}

  <div class="settings-section-label">Preferences</div>
  <div class="profile-card">
    <div class="profile-label" style="margin-bottom:12px;">Appearance</div>
    ${renderThemeGroup("Light", theme)}
    ${renderThemeGroup("Dark", theme)}
  </div>
  <div class="profile-card">
    <div class="profile-label" style="margin-bottom:4px;">Currency</div>
    <div class="profile-value" style="font-weight:500;color:var(--ink-soft);margin-bottom:12px;font-size:12px;">Changes how amounts are displayed only — doesn't convert anything.</div>
    ${renderCurrencyChips()}
  </div>

  ${settingsSection("Data", [
    {
      id: "profileExportBtn",
      icon: "download",
      label: "Export",
      value: "Download everything as a CSV file",
    },
    {
      id: "profileStatementBtn",
      icon: "doc",
      label: "Statement",
      value: "A shareable PDF summary for the current month",
    },
    {
      id: "profileBackupBtn",
      icon: "archive",
      label: "Backup",
      value: "Full backup you can restore from later",
    },
  ])}

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

  <div class="made-by-credit">Made by <span>Chadrix</span></div>
  `;
}

// A scrollable row of currency chips — same visual pattern as the theme
// swatches, but simpler (just symbol + label, no color circle).
function renderCurrencyChips() {
  const activeId = currentCurrencyId();
  return `
  <div class="currency-chip-row">
    ${CURRENCIES.map(
      (c) => `
      <button class="currency-chip ${activeId === c.id ? "active" : ""}" data-currency-id="${c.id}">
        <span class="currency-chip-symbol">${c.symbol}</span>
        <span class="currency-chip-label">${c.label}</span>
      </button>
    `,
    ).join("")}
  </div>`;
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

  const headerCard = document.getElementById("profileHeaderCard");
  if (headerCard) headerCard.onclick = openEditProfileSheet;

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

  const appLockBtn = document.getElementById("profileAppLockBtn");
  if (appLockBtn) appLockBtn.onclick = openAppLockSheet;

  const themeSwatches = document.querySelectorAll(".theme-swatch");
  themeSwatches.forEach((btn) => {
    btn.onclick = () => {
      setTheme(btn.dataset.themeId);
      onChange();
    };
  });

  const currencyChips = document.querySelectorAll(".currency-chip");
  currencyChips.forEach((btn) => {
    btn.onclick = () => {
      setCurrency(btn.dataset.currencyId);
      onChange(); // re-render so every amount on screen updates immediately
    };
  });

  const exportBtn = document.getElementById("profileExportBtn");
  if (exportBtn) exportBtn.onclick = exportCSV;

  const statementBtn = document.getElementById("profileStatementBtn");
  if (statementBtn) statementBtn.onclick = exportMonthlyStatementPDF;

  const backupBtn = document.getElementById("profileBackupBtn");
  if (backupBtn) backupBtn.onclick = openBackupSheet;
}
