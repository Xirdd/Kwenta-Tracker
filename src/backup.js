import { DATA, saveData } from "./state.js";
import { supabase } from "./supabaseClient.js";
import { isCloudMode } from "./sync.js";
import { getActiveHouseholdId } from "./household.js";
import { clearSyncQueue } from "./syncQueue.js";
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

export async function unlockBackup(envelope, password) {
  const backup = await decryptEnvelope(envelope, password);
  assertBackupShape(backup);
  return backup;
}

// Fills in anything an older backup file doesn't have.
function normalize(d = {}) {
  return {
    salary: d.salary || {},
    transactions: d.transactions || [],
    budgets: d.budgets || {},
    budgetsSecond: d.budgetsSecond || {},
    customCategories: d.customCategories || [],
    recurring: d.recurring || [],
    bills: d.bills || [],
    goals: d.goals || [],
    loans: d.loans || [],
  };
}

// ORDER MATTERS. In cloud mode the server restore runs FIRST, as one atomic
// database transaction (restore_my_data in supabase/phase1_restore_and_delete.sql):
// either everything in the backup replaces everything on the server, or
// nothing changes at all. Only after it succeeds is the in-memory copy and
// the on-device cache replaced — so a failure at any point leaves both the
// cloud AND what's on screen exactly as they were.
export async function restoreBackup(backup) {
  const next = normalize(backup.data);

  if (isCloudMode()) {
    await restoreToCloud(next);
    clearSyncQueue(); // stale pre-restore edits must not replay on top of it
  }

  DATA.salary = next.salary;
  DATA.transactions = next.transactions;
  DATA.budgets = next.budgets;
  DATA.budgetsSecond = next.budgetsSecond;
  DATA.customCategories = next.customCategories;
  DATA.recurring = next.recurring;
  DATA.bills = next.bills;
  DATA.goals = next.goals;
  DATA.loans = next.loans;
  saveData();
}

// Builds the payload in database-column shape (snake_case), so the SQL
// function can map it straight onto the tables.
function buildRestorePayload(d) {
  const salary = Object.entries(d.salary)
    .filter(([, amt]) => amt)
    .map(([month_key, amount]) => ({ month_key, amount }));

  const transactions = d.transactions.map((tx) => ({
    id: tx.id,
    type: tx.type,
    description: tx.desc || "",
    amount: tx.amount,
    category: tx.category,
    date: tx.date,
    recurring_id: tx.recurringId || null,
    bill_id: tx.billId || null,
    goal_id: tx.goalId || null,
    loan_id: tx.loanId || null,
    loan_kind: tx.loanKind || null,
    tags: tx.tags && tx.tags.length ? tx.tags : null,
  }));

  const budgetCats = new Set([
    ...Object.keys(d.budgets).filter((c) => Number(d.budgets[c]) > 0),
    ...Object.keys(d.budgetsSecond).filter(
      (c) => d.budgetsSecond[c] !== null && d.budgetsSecond[c] !== undefined,
    ),
  ]);
  const budgets = [...budgetCats].map((category) => ({
    category,
    amount: Number(d.budgets[category]) || 0,
    amount_second:
      d.budgetsSecond[category] === undefined ||
      d.budgetsSecond[category] === null
        ? null
        : Number(d.budgetsSecond[category]),
  }));

  const recurring = d.recurring.map((r) => ({
    id: r.id,
    type: r.type,
    description: r.desc || "",
    amount: r.amount,
    category: r.category,
    day_of_month: r.day,
    start_month: r.startMonth,
    active: r.active !== false,
  }));

  const bills = d.bills.map((b) => ({
    id: b.id,
    name: b.name,
    category: b.category,
    custom_category: b.customCategory || null,
    due_day: b.dueDay,
    estimated_amount:
      b.estimatedAmount === undefined ? null : b.estimatedAmount,
    active: b.active !== false,
  }));

  const goals = d.goals.map((g) => ({
    id: g.id,
    name: g.name,
    target_amount: g.targetAmount,
    target_month: g.targetMonth || null,
    active: g.active !== false,
  }));

  const loans = d.loans.map((l) => ({
    id: l.id,
    person: l.person,
    direction: l.direction,
    amount: l.amount,
    date: l.date,
    note: l.note || null,
    active: l.active !== false,
  }));

  const custom_categories = d.customCategories.map((c) => ({
    id: c.id,
    label: c.label,
    color: c.color,
    icon: c.icon || null,
    active: c.active !== false,
  }));

  return {
    salary,
    transactions,
    budgets,
    recurring,
    bills,
    goals,
    loans,
    custom_categories,
  };
}

async function restoreToCloud(d) {
  const { error } = await supabase.rpc("restore_my_data", {
    payload: buildRestorePayload(d),
    p_household_id: getActiveHouseholdId(),
  });
  if (error) throw error;
}
