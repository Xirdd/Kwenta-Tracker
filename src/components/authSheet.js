import { openModal, closeModal } from "./modal.js";
import {
  signInWithPassword,
  signUpWithPassword,
  sendMagicLink,
  markPendingPasswordSetup,
} from "../auth.js";
import { escapeHtml } from "../format.js";
import { requireMfaIfNeeded } from "./mfaChallengeSheet.js";

let mode = "signin"; // 'signin' | 'signup'

export function openAuthSheet() {
  mode = "signin";
  render();
}

function render(message, prefillEmail) {
  openModal(`
    <div class="grabber"></div>
    <div class="auth-tabs">
      <button class="auth-tab ${mode === "signin" ? "active" : ""}" id="tabSignin">Sign in</button>
      <button class="auth-tab ${mode === "signup" ? "active" : ""}" id="tabSignup">Create account</button>
    </div>
    <h3>${mode === "signin" ? "Welcome back" : "Save your ledger to an account"}</h3>
    <div class="field">
      <label>Email</label>
      <input id="authEmail" type="email" placeholder="you@example.com" autocomplete="email" value="${escapeHtml(prefillEmail || "")}"/>
    </div>
    <div class="field">
      <label>Password <span class="opt">(optional — leave blank for a magic link)</span></label>
      <input id="authPassword" type="password" placeholder="At least 6 characters" autocomplete="${mode === "signin" ? "current-password" : "new-password"}"/>
      ${mode === "signup" ? `<p class="field-hint">Needs to be at least 6 characters.</p>` : ""}
    </div>
    ${message ? `<p class="auth-message">${message}</p>` : ""}
    <div class="sheet-actions" style="flex-direction:column;">
      <button class="btn btn-primary" id="authPrimaryBtn">${mode === "signin" ? "Sign in" : "Create account"}</button>
      <button class="btn btn-ghost" id="authMagicBtn">${mode === "signin" ? "Email me a magic link" : "Email me a magic link to sign up"}</button>
    </div>
  `);

  document.getElementById("tabSignin").onclick = () => {
    mode = "signin";
    render(undefined, currentEmail());
  };
  document.getElementById("tabSignup").onclick = () => {
    mode = "signup";
    render(undefined, currentEmail());
  };

  document.getElementById("authPrimaryBtn").onclick = async () => {
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;

    if (!email || !password) {
      render(
        "Enter your email and a password, or use the magic link option below.",
        email,
      );
      return;
    }
    if (mode === "signup" && password.length < 6) {
      render("Password needs to be at least 6 characters.", email);
      return;
    }

    const primaryBtn = document.getElementById("authPrimaryBtn");
    const defaultLabel = primaryBtn.textContent;
    primaryBtn.disabled = true;
    primaryBtn.textContent =
      mode === "signin" ? "Signing in…" : "Creating account…";

    try {
      if (mode === "signin") {
        await signInWithPassword(email, password);
        // If 2FA is enabled, this swaps the sheet into a code-entry step
        // and only closes once that's verified — otherwise closes right away.
        await requireMfaIfNeeded(closeModal);
      } else {
        const data = await signUpWithPassword(email, password);
        if (data.session) {
          // Email confirmation is off (or already confirmed) — signed in immediately.
          closeModal();
        } else {
          // Email confirmation is required — no session yet, so nothing to close into.
          render(
            "Account created! Check your email to confirm it, then come back and sign in.",
            email,
          );
        }
      }
    } catch (e) {
      render(e.message || "Something went wrong. Please try again.", email);
    } finally {
      // render() above already rebuilds the whole sheet on the success/no-op
      // paths that stay open, but restore this defensively in case closeModal()
      // was somehow skipped — cheap safety net against a permanently stuck button.
      if (primaryBtn.isConnected) {
        primaryBtn.disabled = false;
        primaryBtn.textContent = defaultLabel;
      }
    }
  };

  document.getElementById("authMagicBtn").onclick = async () => {
    const email = document.getElementById("authEmail").value.trim();
    if (!email) {
      render("Enter your email first.", email);
      return;
    }
    const magicBtn = document.getElementById("authMagicBtn");
    const defaultLabel = magicBtn.textContent;
    magicBtn.disabled = true;
    magicBtn.textContent = "Sending…";
    try {
      await sendMagicLink(email);
      if (mode === "signup") markPendingPasswordSetup(); // only mark it once the email actually sent
      render("Check your email for a sign-in link.", email);
    } catch (e) {
      render(
        e.message || "Could not send the magic link. Please try again.",
        email,
      );
    } finally {
      if (magicBtn.isConnected) {
        magicBtn.disabled = false;
        magicBtn.textContent = defaultLabel;
      }
    }
  };
}

function currentEmail() {
  const el = document.getElementById("authEmail");
  return el ? el.value.trim() : "";
}

export { closeModal as closeAuthSheet };
