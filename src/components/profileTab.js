import { getCurrentUser, signOut } from "../auth.js";
import { getActiveHousehold } from "../household.js";
import { currentTheme, toggleTheme } from "../theme.js";
import { escapeHtml } from "../format.js";
import { exportCSV } from "../export.js";
import { openAuthSheet } from "./authSheet.js";
import { openHouseholdSheet } from "./householdSheet.js";
import { openSetPasswordSheet } from "./setPasswordSheet.js";

let onChange = () => {};

export function initProfileTab(rerenderCallback) {
  onChange = rerenderCallback;
}

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
      <button class="btn btn-ghost" id="profileAuthBtn">${user ? "Sign out" : "Sign in"}</button>
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
      <button class="btn btn-ghost" id="profileHouseholdBtn">${household ? "Manage" : "Share budget"}</button>
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
  `
      : ""
  }

  <div class="profile-card">
    <div class="profile-row">
      <div>
        <div class="profile-label">Appearance</div>
        <div class="profile-value">${theme === "dark" ? "Dark" : "Light"} mode</div>
      </div>
      <button class="btn btn-ghost" id="profileThemeBtn">Switch to ${theme === "dark" ? "light" : "dark"}</button>
    </div>
  </div>

  <div class="profile-card">
    <div class="profile-row">
      <div>
        <div class="profile-label">Export</div>
        <div class="profile-value">Download everything as a CSV file</div>
      </div>
      <button class="btn btn-ghost" id="profileExportBtn">Export</button>
    </div>
  </div>
  `;
}

export function attachProfileEvents() {
  const authBtn = document.getElementById("profileAuthBtn");
  if (authBtn) {
    authBtn.onclick = async () => {
      const user = getCurrentUser();
      if (user) {
        await signOut(); // onAuthChange (main.js) handles the re-render + falling back to local data
      } else {
        openAuthSheet();
      }
    };
  }

  const householdBtn = document.getElementById("profileHouseholdBtn");
  if (householdBtn) householdBtn.onclick = openHouseholdSheet;

  const passwordBtn = document.getElementById("profilePasswordBtn");
  if (passwordBtn)
    passwordBtn.onclick = () => openSetPasswordSheet({ context: "manual" });

  const themeBtn = document.getElementById("profileThemeBtn");
  if (themeBtn)
    themeBtn.onclick = () => {
      toggleTheme();
      onChange();
    };

  const exportBtn = document.getElementById("profileExportBtn");
  if (exportBtn) exportBtn.onclick = exportCSV;
}
