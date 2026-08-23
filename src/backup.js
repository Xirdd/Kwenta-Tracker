import { DATA, saveData } from "./state.js";
import { isCloudMode } from "./sync.js";

const BACKUP_VERSION = 1;

// Builds the backup object and triggers a download — this is the entire
// export path, and it's fully safe: it only reads DATA, which is already
// in memory, no network calls or table-name assumptions involved.
export function exportBackup() {
  const backup = {
    kwentaBackupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      salary: DATA.salary,
      transactions: DATA.transactions,
      budgets: DATA.budgets,
      recurring: DATA.recurring,
      bills: DATA.bills,
      goals: DATA.goals,
      loans: DATA.loans,
    },
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kwenta-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Reads and validates an uploaded backup file — doesn't apply it yet, just
// parses and sanity-checks the shape so the caller can show what's about to
// be restored (date, transaction count) before asking for confirmation.
export function parseBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (e) {
        reject(
          new Error(
            "That file isn't valid JSON — is this actually a Kwenta backup file?",
          ),
        );
        return;
      }
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !parsed.data ||
        typeof parsed.kwentaBackupVersion !== "number"
      ) {
        reject(new Error("This doesn't look like a Kwenta backup file."));
        return;
      }
      resolve(parsed);
    };
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsText(file);
  });
}

// Applies a validated backup, replacing everything currently in DATA.
// Local storage is fully handled here — safe, no external dependencies
// beyond what's already known (state.js, storage.js).
//
// Cloud sync is NOT yet wired in here — restoring while signed in currently
// only updates the local copy, not what's stored in Supabase. Completing
// that needs sync.js's existing per-item cloud-upsert functions (reusing
// their already-correct field-name mapping — e.g. the transaction "desc"
// field maps to a "description" column in the database, a detail that
// already lives correctly in sync.js and shouldn't be re-guessed here).
export async function restoreBackup(backup) {
  const d = backup.data || {};
  DATA.salary = d.salary || {};
  DATA.transactions = d.transactions || [];
  DATA.budgets = d.budgets || {};
  DATA.recurring = d.recurring || [];
  DATA.bills = d.bills || [];
  DATA.goals = d.goals || [];
  DATA.loans = d.loans || [];

  saveData();

  if (isCloudMode()) {
    // TODO: push the restored data to Supabase too, once wired up — right
    // now this only affects the local copy. See the note above.
    console.warn(
      "[Kwenta] Backup restored locally. Cloud sync for restore is not yet implemented — see backup.js.",
    );
  }
}
