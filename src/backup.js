import { DATA, saveData } from "./state.js";
import { supabase } from "./supabaseClient.js";
import {
  isCloudMode,
  cloudUpsertSalary,
  cloudUpsertTransaction,
  cloudUpsertBudget,
  cloudUpsertRecurring,
  cloudUpsertBill,
  cloudUpsertGoal,
  cloudUpsertLoan,
} from "./sync.js";

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

// Applies a validated backup, replacing everything currently in DATA — and,
// when signed in, replacing what's stored in Supabase too.
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
    await restoreToCloud(DATA);
  }
}

// Wipes every cloud table for the current user (wipe_my_data(), from
// backup_restore.sql — separate from account deletion, since restoring
// shouldn't touch household membership), then pushes the restored data back
// up using sync.js's own upsert functions. Reusing those rather than
// writing new raw inserts means the already-correct field mapping (e.g.
// the transaction "desc" field maps to a "description" column) doesn't
// need to be re-derived here — same job-list-then-Promise.all pattern
// sync.js already uses for cloudMigrateLocalDataIfEmpty.
async function restoreToCloud(data) {
  const { error: wipeError } = await supabase.rpc("wipe_my_data");
  if (wipeError) throw wipeError;

  const jobs = [];
  Object.entries(data.salary || {}).forEach(([mk, amt]) => {
    if (amt) jobs.push(cloudUpsertSalary(mk, amt));
  });
  (data.transactions || []).forEach((tx) =>
    jobs.push(cloudUpsertTransaction(tx)),
  );
  Object.entries(data.budgets || {}).forEach(([cat, amt]) => {
    if (amt) jobs.push(cloudUpsertBudget(cat, amt));
  });
  (data.recurring || []).forEach((rule) =>
    jobs.push(cloudUpsertRecurring(rule)),
  );
  (data.bills || []).forEach((bill) => jobs.push(cloudUpsertBill(bill)));
  (data.goals || []).forEach((goal) => jobs.push(cloudUpsertGoal(goal)));
  (data.loans || []).forEach((loan) => jobs.push(cloudUpsertLoan(loan)));
  await Promise.all(jobs);
}
