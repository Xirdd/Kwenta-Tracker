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
import { cloudUpsertCustomCategory } from "./customCategoriesCloud.js";
import {
  encryptJSON,
  decryptEnvelope,
  isEncryptedEnvelope,
} from "./backupCrypto.js";

const BACKUP_VERSION = 1;

function buildBackup() {
  return {
    kwentaBackupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      salary: DATA.salary,
      transactions: DATA.transactions,
      budgets: DATA.budgets,
      budgetsSecond: DATA.budgetsSecond,
      customCategories: DATA.customCategories,
      recurring: DATA.recurring,
      bills: DATA.bills,
      goals: DATA.goals,
      loans: DATA.loans,
    },
  };
}

function download(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// With no password, this is exactly the plain JSON backup it always was.
// With one, the whole backup is encrypted first (see backupCrypto.js) and the
// downloaded file contains only the ciphertext envelope — the filename says
// "-encrypted" so it's obvious at a glance which kind you're holding.
export async function exportBackup(password) {
  const backup = buildBackup();
  const stamp = new Date().toISOString().slice(0, 10);
  if (password) {
    const envelope = await encryptJSON(backup, password);
    download(
      `kwenta-backup-${stamp}-encrypted.json`,
      JSON.stringify(envelope, null, 2),
    );
  } else {
    download(`kwenta-backup-${stamp}.json`, JSON.stringify(backup, null, 2));
  }
}

function assertBackupShape(parsed) {
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !parsed.data ||
    typeof parsed.kwentaBackupVersion !== "number"
  ) {
    throw new Error("This doesn't look like a Kwenta backup file.");
  }
}

// Resolves with the parsed backup for a plain file, OR with the still-locked
// envelope for an encrypted one (check with isEncryptedBackup() below) — an
// encrypted file isn't an error, it just needs a password before it can be
// read, which is the caller's (backupSheet.js) job to ask for.
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
      if (isEncryptedEnvelope(parsed)) {
        resolve(parsed);
        return;
      }
      try {
        assertBackupShape(parsed);
      } catch (e) {
        reject(e);
        return;
      }
      resolve(parsed);
    };
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsText(file);
  });
}

export function isEncryptedBackup(parsed) {
  return isEncryptedEnvelope(parsed);
}

// Turns a locked envelope + password into the same backup object a plain
// file would have given. A wrong password (or a damaged file) throws the
// friendly error from backupCrypto.js.
export async function unlockBackup(envelope, password) {
  const backup = await decryptEnvelope(envelope, password);
  assertBackupShape(backup); // decrypting succeeded, but confirm what's inside is actually a Kwenta backup
  return backup;
}

export async function restoreBackup(backup) {
  const d = backup.data || {};
  DATA.salary = d.salary || {};
  DATA.transactions = d.transactions || [];
  DATA.budgets = d.budgets || {};
  // Backups made before these existed just mean "nothing extra" — every
  // category used one limit for both halves, and there were no custom ones.
  DATA.budgetsSecond = d.budgetsSecond || {};
  DATA.customCategories = d.customCategories || [];
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
  (data.customCategories || []).forEach((cat) =>
    jobs.push(cloudUpsertCustomCategory(cat)),
  );
  await Promise.all(jobs);

  // Second-half limits go in AFTER the budget rows above exist — they update
  // that same row, and running them in parallel with the inserts would race.
  for (const [cat, amt] of Object.entries(data.budgetsSecond || {})) {
    await cloudSetBudgetSecond(cat, amt);
  }
}