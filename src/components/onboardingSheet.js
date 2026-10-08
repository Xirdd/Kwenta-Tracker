import "./onboarding.css";
import { DATA } from "../state.js";
import { getCurrentUser } from "../auth.js";
import { openModal, closeModal } from "./modal.js";

// A short first-run walkthrough, shown at most once per account on a device,
// and only for accounts that look brand new (nothing logged yet) — so existing
// users never see it. It's a normal dialog, so Escape, a tap outside, or Skip
// all just end it.

const STEPS = [
  {
    icon: "₱",
    title: "Welcome to Kwenta",
    body: "Sulit sa bawat piso — a private ledger for your income, expenses, bills, goals and utang. Here's a 30-second tour.",
  },
  {
    icon: "+",
    title: "Log things in a tap",
    body: "Open the Expenses or Income tab under Overview and tap the + button. On Expenses, the category chips at the top pre-fill the form, so you only type an amount. Your salary goes on the Income tab.",
  },
  {
    icon: "🎯",
    title: "Budgets, bills, goals, utang",
    body: "Budgets and Bills are tabs under Overview — set limits, track due dates. Goals and Utang are on the bottom bar: save toward a target, and keep track of who owes who.",
  },
  {
    icon: "🔒",
    title: "Private by default",
    body: "In Settings you can turn on two-factor authentication and an App Lock passcode, or share a household budget with a code. Your photo and name live under the person icon at the top. Your salary always stays private, even in a household.",
  },
];

function flagKey(user) {
  return `kwenta_onboarded_v1:${user.id}`;
}

function alreadySeen(user) {
  try {
    return localStorage.getItem(flagKey(user)) === "1";
  } catch (e) {
    return true; // can't remember it, so don't risk showing it every time
  }
}

function markSeen(user) {
  try {
    localStorage.setItem(flagKey(user), "1");
  } catch (e) {
    /* ignore */
  }
}

function looksNew() {
  return (
    DATA.transactions.length === 0 &&
    DATA.bills.length === 0 &&
    DATA.goals.length === 0 &&
    DATA.loans.length === 0 &&
    Object.keys(DATA.salary).length === 0
  );
}

// Call after the app has loaded for a signed-in, unlocked person.
export function maybeShowOnboarding() {
  const user = getCurrentUser();
  if (!user || alreadySeen(user) || !looksNew()) return;
  markSeen(user); // marked when shown, so a reload never nags
  render(0);
}

function render(index) {
  const step = STEPS[index];
  const isFirst = index === 0;
  const isLast = index === STEPS.length - 1;

  openModal(
    `
    <div class="grabber"></div>
    <div class="onb-icon" aria-hidden="true">${step.icon}</div>
    <h3 class="onb-title">${step.title}</h3>
    <p class="onb-body">${step.body}</p>
    <div class="onb-dots" aria-hidden="true">
      ${STEPS.map((_, i) => `<span class="${i === index ? "active" : ""}"></span>`).join("")}
    </div>
    <p class="onb-count">Step ${index + 1} of ${STEPS.length}</p>
    <div class="sheet-actions">
      ${
        isFirst
          ? `<button class="btn btn-ghost" id="onbSkipBtn">Skip</button>`
          : `<button class="btn btn-ghost" id="onbBackBtn">Back</button>`
      }
      <button class="btn btn-primary" id="onbNextBtn">${isLast ? "Get started" : "Next"}</button>
    </div>
  `,
    closeModal, // tap outside / Escape just ends the tour
  );

  const skip = document.getElementById("onbSkipBtn");
  if (skip) skip.onclick = closeModal;
  const back = document.getElementById("onbBackBtn");
  if (back) back.onclick = () => render(index - 1);
  document.getElementById("onbNextBtn").onclick = () => {
    if (isLast) closeModal();
    else render(index + 1);
  };
}
