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
import { cloudSetBudgetSecond } from "./budgetLimitsCloud.js";

const BACKUP_VERSION = 1;

export function exportBackup() {
  const backup = {
    kwentaBackupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      salary: DATA.salary,
      transactions: DATA.transactions,
      budgets: DATA.budgets,
      budgetsSecond: DATA.budgetsSecond,
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

export async function restoreBackup(backup) {
  const d = backup.data || {};
  DATA.salary = d.salary || {};
  DATA.transactions = d.transactions || [];
  DATA.budgets = d.budgets || {};
  // Backups made before semi-monthly limits existed have no budgetsSecond —
  // that just means every category uses one limit for both halves.
  DATA.budgetsSecond = d.budgetsSecond || {};
  DATA.recurring = d.recurring || [];
  DATA.bills = d.bills || [];
  DATA.goals = d.goals || [];
  DATA.loans = d.loans || [];

  saveData();

  if (isCloudMode()) {
    await restoreToCloud(DATA);
  }
}

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

  // Second-half limits go in AFTER the budget rows above exist — they update
  // that same row, and running them in parallel with the inserts would race.
  for (const [cat, amt] of Object.entries(data.budgetsSecond || {})) {
    await cloudSetBudgetSecond(cat, amt);
  }
}
