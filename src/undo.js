import "./toastUndo.css";
import { showUndoToast } from "./toast.js";

// Generic "delete now, but give a few seconds to undo" helper — used by
// sheet.js (expense/income) and budgets.js (custom categories) so far.
//
// The actual cloud delete (and anything else that should only happen once
// the delete is truly final, like stopping a recurring rule) is deferred
// until the undo window passes — `commit()` runs then, not immediately. If
// Undo is pressed, `commit()` never runs at all, and `restore()` puts the
// item back. `remove()` only touches the in-memory array + re-render; it
// deliberately does NOT persist to localStorage, so a page reload during the
// undo window reloads the old (undeleted) state instead of risking a
// permanent loss if the tab closes before the window ends.
export function scheduleUndoableDelete({ label, remove, restore, commit }) {
  remove();

  let committed = false;
  const timer = setTimeout(() => {
    committed = true;
    commit();
  }, 6000);

  showUndoToast(`${label} deleted.`, () => {
    if (committed) return; // toast can be dismissed after the window closes too; ignore a stale click
    clearTimeout(timer);
    restore();
  });
}
