import { openModal, closeModal } from "./modal.js";
import { listMySessions, signOutOtherDevices } from "../auth.js";
import { timeAgo } from "../format.js";

export function openDevicesSheet() {
  render();
}

async function render() {
  openModal(
    `
    <div class="grabber"></div>
    <h3>Signed in on</h3>
    <p class="auth-message" style="margin-top:-4px;">Loading…</p>
  `,
    closeModal,
  );

  let sessions, currentSessionId;
  try {
    ({ sessions, currentSessionId } = await listMySessions());
  } catch (e) {
    renderError(e.message || "Couldn't load your sessions right now.");
    return;
  }
  renderList(sessions, currentSessionId);
}

function renderError(message) {
  openModal(
    `
    <div class="grabber"></div>
    <h3>Signed in on</h3>
    <p class="auth-message" style="color:var(--coral);">${message}</p>
    <div class="sheet-actions" style="margin-top:14px;">
      <button class="btn btn-ghost" id="devicesCloseBtn">Close</button>
    </div>
  `,
    closeModal,
  );
  document.getElementById("devicesCloseBtn").onclick = closeModal;
}

function renderList(sessions, currentSessionId, message) {
  const otherCount = sessions.filter((s) => s.id !== currentSessionId).length;

  const rows = sessions
    .map((s) => {
      const isCurrent = s.id === currentSessionId;
      const device = describeDevice(s.user_agent);
      return `
    <div class="device-row ${isCurrent ? "current" : ""}">
      <div class="device-icon">${isCurrent ? CURRENT_ICON : DEVICE_ICON}</div>
      <div class="device-info">
        <div class="device-name">${device}${isCurrent ? ' <span class="device-badge">This device</span>' : ""}</div>
        <div class="device-meta">Active ${timeAgo(s.updated_at || s.created_at)}</div>
      </div>
    </div>`;
    })
    .join("");

  openModal(
    `
    <div class="grabber"></div>
    <h3>Signed in on</h3>
    <p class="auth-message" style="margin-top:-4px;">${sessions.length} active session${sessions.length === 1 ? "" : "s"}${otherCount ? ` — ${otherCount} other than this one` : ""}.</p>
    <div class="device-list">${rows || '<p class="auth-message">No active sessions found.</p>'}</div>
    ${message ? `<p class="auth-message" style="color:var(--coral);">${message}</p>` : ""}
    <div class="sheet-actions" style="margin-top:14px;">
      <button class="btn btn-ghost" id="devicesCloseBtn">Close</button>
      ${otherCount ? `<button class="btn btn-danger" id="devicesSignOutOthersBtn">Sign out other devices</button>` : ""}
    </div>
  `,
    closeModal,
  );

  document.getElementById("devicesCloseBtn").onclick = closeModal;

  const signOutBtn = document.getElementById("devicesSignOutOthersBtn");
  if (signOutBtn) {
    signOutBtn.onclick = async () => {
      signOutBtn.disabled = true;
      signOutBtn.textContent = "Signing out other devices…";
      try {
        await signOutOtherDevices();
        renderList(
          [sessions.find((s) => s.id === currentSessionId) || sessions[0]],
          currentSessionId,
          "Every other device has been signed out.",
        );
      } catch (e) {
        renderList(
          sessions,
          currentSessionId,
          e.message || "Couldn't sign out other devices. Please try again.",
        );
      }
    };
  }
}

const DEVICE_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M12 18h.01"/></svg>`;
const CURRENT_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

// Best-effort, readable device label from the raw user-agent string — this
// doesn't need to be exhaustive, just recognizable ("Chrome on Windows"
// beats a raw UA string dumped on screen). Falls back cleanly if the
// user_agent column isn't available on this Supabase project (see the
// fallback logic in list_my_sessions() in schema.sql).
function describeDevice(userAgent) {
  if (!userAgent) return "Unknown device";
  const ua = userAgent;
  let os = "Unknown OS";
  if (/iphone|ipad/i.test(ua)) os = "iOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/mac os/i.test(ua)) os = "Mac";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/linux/i.test(ua)) os = "Linux";

  let browser = "a browser";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/chrome\//i.test(ua)) browser = "Chrome";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua)) browser = "Safari";

  return `${browser} on ${os}`;
}
