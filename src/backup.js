import { DATA, saveData } from "./state.js";
import { supabase } from "./supabaseClient.js";
import { isCloudMode, cloudLoadAll } from "./sync.js";
import { getCurrentUser } from "./auth.js";
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
      // transactions/recurring/bills/goals/loans/customCategories already
      // carry a `userId` field when loaded from the cloud (see sync.js) —
      // that's what lets a household restore below put back only the
      // entries this account owns, instead of duplicating everyone else's.
      transactions: DATA.transactions,
      budgets: DATA.budgets,
      budgetsSecond: DATA.budgetsSecond,
      customCategories: DATA.customCategories,
      recurring: DATA.recurring,
      bills: DATA.bills,
      goals: DATA.goals,
      loans: DATA.loans,
      wallets: DATA.wallets,
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
    wallets: d.wallets || [],
  };
}

// Keeps only the items THIS account owns. A row with no `userId` (an older
// backup, made before items carried one, or something that only ever lived
// locally) is treated as the restorer's own — same as it always was.
function keepOwnedBy(items, userId) {
  return items.filter((item) => !item.userId || item.userId === userId);
}

// While in a household, a backup export can contain every member's shared
// entries — DATA holds the whole household's data, not just yours (see
// sync.js's cloudLoadAll). restore_my_data's own delete step only clears
// the RESTORING user's rows, by design, so other members' data is never
// touched on the server. But the old client sent the WHOLE backup back as
// the thing to re-insert, so every other member's entries got duplicated —
// a second copy, now owned by whoever restored. This filters the payload
// down to this account's own items first; everyone else's data is left
// exactly as it already is on the server.
function scopeForRestore(data, { householdId, userId }) {
  if (!householdId) return data; // personal ledger — restore applies to all of it, as before
  return {
    ...data,
    transactions: keepOwnedBy(data.transactions, userId),
    recurring: keepOwnedBy(data.recurring, userId),
    bills: keepOwnedBy(data.bills, userId),
    goals: keepOwnedBy(data.goals, userId),
    loans: keepOwnedBy(data.loans, userId),
    wallets: keepOwnedBy(data.wallets, userId),
    customCategories: keepOwnedBy(data.customCategories, userId),
  };
}

// What backupSheet.js shows in its before/after preview — the counts a
// household restore will ACTUALLY apply, not the full (possibly
// everyone's-data) contents of the file.
export function scopedRestoreData(backup) {
  const user = getCurrentUser();
  return scopeForRestore(normalize(backup.data), {
    householdId: getActiveHouseholdId(),
    userId: user?.id,
  });
}

// ORDER MATTERS. In cloud mode the server restore runs FIRST, as one atomic
// database transaction (restore_my_data in supabase/phase1_restore_and_delete.sql):
// either everything in the (scoped) payload replaces this account's rows, or
// nothing changes at all. Only after it succeeds is the in-memory copy and
// the on-device cache replaced — so a failure at any point leaves both the
// cloud AND what's on screen exactly as they were.
export async function restoreBackup(backup) {
  const householdId = getActiveHouseholdId();
  const user = getCurrentUser();
  const next = scopeForRestore(normalize(backup.data), {
    householdId,
    userId: user?.id,
  });

  if (isCloudMode()) {
    await restoreToCloud(next, householdId);
    clearSyncQueue(); // stale pre-restore edits must not replay on top of it

    if (householdId) {
      // Other members' rows were never touched — reload from the cloud
      // rather than reconstructing DATA from `next` alone, so their data
      // (which this restore deliberately left out of `next`) stays visible.
      const cloud = await cloudLoadAll();
      if (cloud) {
        applyToState(cloud);
        return;
      }
    }
  }

  applyToState(next);
}

function applyToState(next) {
  DATA.salary = next.salary;
  DATA.transactions = next.transactions;
  DATA.budgets = next.budgets;
  DATA.budgetsSecond = next.budgetsSecond;
  DATA.customCategories = next.customCategories;
  DATA.recurring = next.recurring;
  DATA.bills = next.bills;
  DATA.goals = next.goals;
  DATA.loans = next.loans;
  DATA.wallets = next.wallets;
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

  const wallets = d.wallets.map((w) => ({
    id: w.id,
    name: w.name,
    provider: w.provider || "other",
    starting_balance: w.startingBalance || 0,
    active: w.active !== false,
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
    wallets,
    custom_categories,
  };
}

// `householdId` is passed through explicitly (rather than re-read inside)
// so this always restores into whichever household the scoping above was
// computed for, even if something changed it mid-call.
async function restoreToCloud(d, householdId) {
  const { error } = await supabase.rpc("restore_my_data", {
    payload: buildRestorePayload(d),
    p_household_id: householdId,
  });
  if (error) throw error;
}
