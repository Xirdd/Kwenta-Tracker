import { openModal, closeModal } from "./modal.js";
import {
  signInWithPassword,
  signUpWithPassword,
  sendMagicLink,
  markPendingPasswordSetup,
} from "../auth.js";

let mode = "signin"; // 'signin' | 'signup'

export function openAuthSheet() {
  mode = "signin";
  render();
}

function render(message) {
  openModal(`
    <div class="grabber"></div>
    <div class="auth-tabs">
      <button class="auth-tab ${mode === "signin" ? "active" : ""}" id="tabSignin">Sign in</button>
      <button class="auth-tab ${mode === "signup" ? "active" : ""}" id="tabSignup">Create account</button>
    </div>
    <h3>${mode === "signin" ? "Welcome back" : "Save your ledger to an account"}</h3>
    <div class="field">
      <label>Email</label>
      <input id="authEmail" type="email" placeholder="you@example.com" autocomplete="email"/>
    </div>
    <div class="field">
      <label>Password <span class="opt">(optional — leave blank for a magic link)</span></label>
      <input id="authPassword" type="password" placeholder="••••••••" autocomplete="${mode === "signin" ? "current-password" : "new-password"}"/>
    </div>
    ${message ? `<p class="auth-message">${message}</p>` : ""}
    <div class="sheet-actions" style="flex-direction:column;">
      <button class="btn btn-primary" id="authPrimaryBtn">${mode === "signin" ? "Sign in" : "Create account"}</button>
      <button class="btn btn-ghost" id="authMagicBtn">${mode === "signin" ? "Email me a magic link" : "Email me a magic link to sign up"}</button>
    </div>
  `);

  document.getElementById("tabSignin").onclick = () => {
    mode = "signin";
    render();
  };
  document.getElementById("tabSignup").onclick = () => {
    mode = "signup";
    render();
  };

  document.getElementById("authPrimaryBtn").onclick = async () => {
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    if (!email || !password) {
      render(
        "Enter your email and a password, or use the magic link option below.",
      );
      return;
    }
    try {
      if (mode === "signin") {
        await signInWithPassword(email, password);
      } else {
        await signUpWithPassword(email, password);
      }
      closeModal(); // onAuthChange will re-render the app and pull/sync the data
    } catch (e) {
      render(e.message || "Something went wrong. Please try again.");
    }
  };

  document.getElementById("authMagicBtn").onclick = async () => {
    const email = document.getElementById("authEmail").value.trim();
    if (!email) {
      render("Enter your email first.");
      return;
    }
    try {
      if (mode === "signup") markPendingPasswordSetup();
      await sendMagicLink(email);
      render("Check your email for a sign-in link.");
    } catch (e) {
      render(e.message || "Could not send the magic link. Please try again.");
    }
  };
}

export { closeModal as closeAuthSheet };
