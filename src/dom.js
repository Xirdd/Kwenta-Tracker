// Tiny DOM helpers shared by the sheets.

// Briefly outlines a field in coral to say "this one needs a value".
// (Replaces identical copies that lived in billSheet, goalSheet, loanSheet,
// householdSheet and sheet.js.)
export function flashField(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = "var(--coral)";
  setTimeout(() => {
    el.style.borderColor = "transparent";
  }, 700);
}
