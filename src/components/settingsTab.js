import "./profileSettings.css";
import { getCurrentUser, signOut } from "../auth.js";
import { getActiveHousehold } from "../household.js";
import { currentTheme, THEMES } from "../theme.js";
import { PERIOD_MODES, getPeriodMode } from "../periodMode.js";
import { currentCurrencyId, CURRENCIES } from "../currency.js";
import { escapeHtml } from "../format.js";
import { exportCSV } from "../export.js";
import { exportMonthlyStatementPDF } from "../pdfExport.js";
import { isLockEnabled, lockTypeLabel } from "../appLock.js";
import { openHouseholdSheet } from "./householdSheet.js";
import { openSetPasswordSheet } from "./setPasswordSheet.js";
import { openDeleteAccountSheet } from "./deleteAccountSheet.js";
import { openDevicesSheet } from "./devicesSheet.js";
import { openMfaSetupSheet } from "./mfaSetupSheet.js";
import { openNotificationsSheet } from "./notificationsSheet.js";
import { openBackupSheet } from "./backupSheet.js";
import { openAppLockSheet } from "./appLockSheet.js";
import {
  openThemePicker,
  openPeriodPicker,
  openCurrencyPicker,
} from "./settingsPickers.js";

// The Settings screen (bottom-nav "Settings"). It's a list of grouped rows:
// each shows its CURRENT value and opens a sheet when tapped, so nothing is
// spread out on the screen at once. Who you are (photo, name, email) lives on
// the Profile page, reached from the header.

let onChange = () => {};

export function initSettingsTab(rerenderCallback) {
  onChange = rerenderCallback;
}

const SIGNOUT_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>`;
const TRASH_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
const CHEVRON_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

// Small icon set for the grouped settings rows — 24x24 stroke glyphs,
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
  palette: `<circle cx="13.5" cy="6.5" r=".6"/><circle cx="17.5" cy="10.5" r=".6"/><circle cx="8.5" cy="7.5" r=".6"/><circle cx="6.5" cy="12.5" r=".6"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.1-.7-.4-1-.3-.3-.4-.6-.4-1 0-.8.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-4.9-4.5-9-10-9z"/>`,
  calendar: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
  coins: `<circle cx="12" cy="12" r="9"/><path d="M14.8 9.2c-.4-.8-1.4-1.2-2.8-1.2-1.6 0-2.8.7-2.8 1.8s1.2 1.6 2.8 1.9 2.8.8 2.8 1.9-1.2 1.8-2.8 1.8c-1.4 0-2.4-.4-2.8-1.2"/><path d="M12 6v2m0 8v2"/>`,
};

function rowIcon(key) {
  return `<span class="settings-row-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ROW_ICONS[key]}</svg></span>`;
}

// One card per section, holding one or more tappable rows. `rows` is an array
// of { id, icon, label, value }; `value` is trusted HTML (callers escape any
// user-supplied text). Click handlers are wired in attachSettingsEvents() by id.
function settingsSection(label, rows) {
  if (rows.length === 0) return "";
  return `
  <div class="settings-section-label">${label}</div>
  <div class="settings-card">
    ${rows
      .map(
        (r) => `
      <div class="settings-row" id="${r.id}" role="button" tabindex="0">
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

export function renderSettingsTab() {
  const user = getCurrentUser();
  if (!user) return ""; // the auth gate never lets a signed-out visitor reach this
  const household = getActiveHousehold();

  const theme = THEMES.find((t) => t.id === currentTheme()) || THEMES[0];
  const period =
    PERIOD_MODES.find((m) => m.id === getPeriodMode()) || PERIOD_MODES[0];
  const currency =
    CURRENCIES.find((c) => c.id === currentCurrencyId()) || CURRENCIES[0];

  return `
  <div class="section-title">Settings</div>

  ${settingsSection("Account", [
    {
      id: "settingHouseholdBtn",
      icon: "home",
      label: "Household",
      value: household
        ? escapeHtml(household.name)
        : "Personal ledger — nothing shared",
    },
  ])}

  ${settingsSection("Security", [
    {
      id: "settingPasswordBtn",
      icon: "lock",
      label: "Password",
      value: "Change your sign-in password",
    },
    {
      id: "settingMfaBtn",
      icon: "shield",
      label: "Two-factor authentication",
      value: "Add a code from an authenticator app",
    },
    {
      id: "settingAppLockBtn",
      icon: "fingerprint",
      label: "App Lock",
      value: isLockEnabled()
        ? `On · ${escapeHtml(lockTypeLabel())}`
        : "Require a PIN or password to open Kwenta",
    },
    {
      id: "settingDevicesBtn",
      icon: "devices",
      label: "Devices",
      value: "See where you're signed in",
    },
  ])}

  ${settingsSection("Notifications", [
    {
      id: "settingNotificationsBtn",
      icon: "bell",
      label: "Notifications",
      value: "Bill reminders and budget alerts",
    },
  ])}

  ${settingsSection("Preferences", [
    {
      id: "settingThemeBtn",
      icon: "palette",
      label: "Appearance",
      value: escapeHtml(theme.label),
    },
    {
      id: "settingPeriodBtn",
      icon: "calendar",
      label: "Budget period",
      value: escapeHtml(period.label),
    },
    {
      id: "settingCurrencyBtn",
      icon: "coins",
      label: "Currency",
      value: `${escapeHtml(currency.symbol)} ${escapeHtml(currency.label)}`,
    },
  ])}

  ${settingsSection("Data", [
    {
      id: "settingExportBtn",
      icon: "download",
      label: "Export",
      value: "Download everything as a CSV file",
    },
    {
      id: "settingStatementBtn",
      icon: "doc",
      label: "Statement",
      value: "A shareable PDF summary for the current month",
    },
    {
      id: "settingBackupBtn",
      icon: "archive",
      label: "Backup",
      value: "Full backup you can restore from later",
    },
  ])}

  <button class="signout-btn" id="settingSignOutBtn">${SIGNOUT_ICON}<span>Sign out</span></button>

  <div class="profile-card danger-card" id="settingDeleteBtn" role="button" tabindex="0">
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

// Rows are <div role="button">, so give them the keyboard behaviour a real
// button has: Enter or Space activates.
function onActivate(id, handler) {
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

export function attachSettingsEvents() {
  onActivate("settingHouseholdBtn", openHouseholdSheet);
  onActivate("settingPasswordBtn", () =>
    openSetPasswordSheet({ context: "manual" }),
  );
  onActivate("settingMfaBtn", openMfaSetupSheet);
  onActivate("settingAppLockBtn", openAppLockSheet);
  onActivate("settingDevicesBtn", openDevicesSheet);
  onActivate("settingNotificationsBtn", openNotificationsSheet);

  onActivate("settingThemeBtn", () => openThemePicker(onChange));
  onActivate("settingPeriodBtn", () => openPeriodPicker(onChange));
  onActivate("settingCurrencyBtn", () => openCurrencyPicker(onChange));

  onActivate("settingExportBtn", exportCSV);
  onActivate("settingStatementBtn", exportMonthlyStatementPDF);
  onActivate("settingBackupBtn", openBackupSheet);

  onActivate("settingDeleteBtn", openDeleteAccountSheet);

  const signOutBtn = document.getElementById("settingSignOutBtn");
  if (signOutBtn) {
    signOutBtn.onclick = async () => {
      await signOut(); // onAuthChange (main.js) handles the re-render + wipe
    };
  }
}
