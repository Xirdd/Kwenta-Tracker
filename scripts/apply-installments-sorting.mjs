#!/usr/bin/env node
// Wires the Installments feature and the global Sort control into the files
// that already exist. Run from the repo root AFTER copying in the new files:
//
//   src/installments.js, src/sorting.js
//   src/components/installmentsTab.js, installmentSheet.js,
//   sortControl.js, sortControl.css
//   supabase/migrations/20261113000000_installments.sql
//
//   node scripts/apply-installments-sorting.mjs --dry
//   node scripts/apply-installments-sorting.mjs
//
// Same safety rule as the other patch scripts: every edit must match exactly
// once, or that whole file is left untouched and reported. Re-running after a
// success reports "no match" for edits already applied; that is harmless.
// Delete this script afterwards.

import fs from "node:fs";
import path from "node:path";

const dry = process.argv.includes("--dry");
const L = (...lines) => lines.join("\n");

const SORT_IMPORTS = L(
  'import { sortList } from "../sorting.js";',
  'import { renderSortButton } from "./sortControl.js";',
);

const PATCHES = [
  // ── Data: DATA.installments ────────────────────────────────────────────
  {
    file: "src/state.js",
    edits: [
      {
        find: "  loans: [],\n  wallets: [],\n};",
        replace: "  loans: [],\n  wallets: [],\n  installments: [],\n};",
      },
      {
        find: "    loans: DATA.loans,\n    wallets: DATA.wallets,\n  };",
        replace:
          "    loans: DATA.loans,\n    wallets: DATA.wallets,\n    installments: DATA.installments,\n  };",
      },
      {
        find: "  DATA.wallets = next.wallets || [];",
        replace:
          "  DATA.wallets = next.wallets || [];\n  DATA.installments = next.installments || [];",
      },
    ],
  },
  {
    file: "src/storage.js",
    edits: [
      {
        find: "    loans: [],\n    wallets: [],\n  };",
        replace:
          "    loans: [],\n    wallets: [],\n    installments: [],\n  };",
      },
      {
        find: "        wallets: parsed.wallets || [],",
        replace:
          "        wallets: parsed.wallets || [],\n        installments: parsed.installments || [],",
      },
    ],
  },

  // ── Cloud: load, save, delete, first-sign-in migration ─────────────────
  {
    file: "src/sync.js",
    edits: [
      {
        find: "    walletsRes,\n  ] = await Promise.all([",
        replace:
          "    walletsRes,\n    installmentsRes,\n  ] = await Promise.all([",
      },
      {
        find: "    scopedWallets(user, householdId),\n  ]);",
        replace:
          '    scopedWallets(user, householdId),\n    scoped("kwenta_installments", user, householdId),\n  ]);',
      },
      {
        find: "    walletsRes,\n  ].forEach(check);",
        replace: "    walletsRes,\n    installmentsRes,\n  ].forEach(check);",
      },
      {
        find: "    walletId: r.wallet_id || undefined,\n    tags:",
        replace:
          "    walletId: r.wallet_id || undefined,\n    installmentId: r.installment_id || undefined,\n    tags:",
      },
      {
        find: L(
          "  return {",
          "    salary,",
          "    transactions,",
          "    budgets,",
          "    recurring,",
          "    bills,",
          "    goals,",
          "    loans,",
          "    wallets,",
          "  };",
        ),
        replace: L(
          "  const installments = (installmentsRes.data || []).map((r) => ({",
          "    id: r.id,",
          "    userId: r.user_id,",
          "    name: r.name,",
          "    totalAmount: Number(r.total_amount),",
          "    monthlyAmount: Number(r.monthly_amount),",
          "    totalMonths: r.total_months,",
          "    remainingMonths: r.remaining_months,",
          '    dueRule: r.due_rule || "last",',
          "    active: r.active,",
          "  }));",
          "",
          "  return {",
          "    salary,",
          "    transactions,",
          "    budgets,",
          "    recurring,",
          "    bills,",
          "    goals,",
          "    loans,",
          "    wallets,",
          "    installments,",
          "  };",
        ),
      },
      {
        find: "    wallet_id: tx.walletId || null,\n    tags:",
        replace:
          "    wallet_id: tx.walletId || null,\n    installment_id: tx.installmentId || null,\n    tags:",
      },
      {
        // g flag: with a capture group and no g, match() returns [whole, group]
        // (length 2) and the "exactly one match" check below miscounts it.
        regex: /\n(\/\/ ── First sign-in)/g,
        skipIf: "export async function cloudUpsertInstallment",
        replace: L(
          "",
          "// ── Installments (SPayLater and similar) ──────────────────────────────",
          "export async function cloudUpsertInstallment(plan) {",
          "  const user = getCurrentUser();",
          "  if (!supabase || !user) return;",
          '  await upsertRow("kwenta_installments", {',
          "    id: plan.id,",
          "    user_id: ownerOf(plan, user),",
          "    household_id: getActiveHouseholdId(),",
          "    name: plan.name,",
          "    total_amount: plan.totalAmount,",
          "    monthly_amount: plan.monthlyAmount,",
          "    total_months: plan.totalMonths,",
          "    remaining_months: plan.remainingMonths,",
          "    due_rule: plan.dueRule,",
          "    active: plan.active !== false,",
          "  });",
          "}",
          "",
          "export async function cloudDeleteInstallment(id) {",
          '  await removeById("kwenta_installments", id);',
          "}",
          "",
          "$1",
        ),
      },
      {
        find: "    existing.loans.length === 0 &&\n    existing.wallets.length === 0;",
        replace:
          "    existing.loans.length === 0 &&\n    existing.wallets.length === 0 &&\n    existing.installments.length === 0;",
      },
      {
        find: L(
          "  (localData.wallets || []).forEach((wallet) =>",
          "    jobs.push(cloudUpsertWallet(adopt(wallet))),",
          "  );",
        ),
        replace: L(
          "  (localData.wallets || []).forEach((wallet) =>",
          "    jobs.push(cloudUpsertWallet(adopt(wallet))),",
          "  );",
          "  (localData.installments || []).forEach((plan) =>",
          "    jobs.push(cloudUpsertInstallment(adopt(plan))),",
          "  );",
        ),
      },
    ],
  },
  {
    // Joining or creating a household shares existing plans like everything else.
    file: "src/household.js",
    edits: [
      {
        find: '    "kwenta_loans",\n    "kwenta_wallets",\n  ];',
        replace:
          '    "kwenta_loans",\n    "kwenta_wallets",\n    "kwenta_installments",\n  ];',
      },
    ],
  },
  {
    file: "src/realtime.js",
    edits: [
      {
        find: '  "kwenta_wallets",\n  "kwenta_custom_categories",',
        replace:
          '  "kwenta_wallets",\n  "kwenta_installments",\n  "kwenta_custom_categories",',
      },
    ],
  },

  // ── Backup / restore ───────────────────────────────────────────────────
  // (Also fixes transactions losing their wallet when restored: wallet_id
  // was never part of the payload.)
  {
    file: "src/backup.js",
    edits: [
      {
        find: "      wallets: DATA.wallets,\n    },",
        replace:
          "      wallets: DATA.wallets,\n      installments: DATA.installments,\n    },",
      },
      {
        find: "    wallets: d.wallets || [],\n  };",
        replace:
          "    wallets: d.wallets || [],\n    installments: d.installments || [],\n  };",
      },
      {
        find: "  DATA.wallets = next.wallets;",
        replace:
          "  DATA.wallets = next.wallets;\n  DATA.installments = next.installments;",
      },
      {
        find: "    wallets: keepOwnedBy(data.wallets, userId),",
        replace:
          "    wallets: keepOwnedBy(data.wallets, userId),\n    installments: keepOwnedBy(data.installments, userId),",
      },
      {
        find: "    d.wallets,\n  ].some",
        replace: "    d.wallets,\n    d.installments,\n  ].some",
      },
      {
        find: L(
          "    loan_kind: tx.loanKind || null,",
          "    tags: tx.tags && tx.tags.length ? tx.tags : null,",
          "  }));",
        ),
        replace: L(
          "    loan_kind: tx.loanKind || null,",
          "    wallet_id: tx.walletId || null,",
          "    installment_id: tx.installmentId || null,",
          "    tags: tx.tags && tx.tags.length ? tx.tags : null,",
          "  }));",
        ),
      },
      {
        find: "  const custom_categories = d.customCategories.map((c) => ({",
        replace: L(
          "  const installments = d.installments.map((p) => ({",
          "    id: p.id,",
          "    name: p.name,",
          "    total_amount: p.totalAmount,",
          "    monthly_amount: p.monthlyAmount,",
          "    total_months: p.totalMonths,",
          "    remaining_months: p.remainingMonths,",
          '    due_rule: p.dueRule || "last",',
          "    active: p.active !== false,",
          "  }));",
          "",
          "  const custom_categories = d.customCategories.map((c) => ({",
        ),
      },
      {
        find: "    wallets,\n    custom_categories,\n  };",
        replace:
          "    wallets,\n    installments,\n    custom_categories,\n  };",
      },
    ],
  },

  // ── Category: Installments / SPayLater (budgetable, shows in Overview) ─
  {
    file: "src/categories.js",
    edits: [
      {
        find: "const ICONS = {\n",
        replace: L(
          "const ICONS = {",
          '  installments: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/>`,',
          "",
        ),
      },
      {
        find: '  { id: "savings", label: "Savings", color: "#7fae3f" },',
        replace: L(
          '  { id: "installments", label: "Installments / SPayLater", color: "#ee4d2d" },',
          '  { id: "savings", label: "Savings", color: "#7fae3f" },',
        ),
      },
    ],
  },

  // ── Navigation: Installments tab, + button, title, row taps ────────────
  {
    file: "src/components/tabs.js",
    edits: [
      {
        find: '  ["wallets", "Wallets"],',
        replace:
          '  ["wallets", "Wallets"],\n  ["installments", "Installments"],',
      },
    ],
  },
  {
    file: "src/components/fabMenu.js",
    edits: [
      {
        find: '    if (tab === "wallets") return handlers.onWallet();',
        replace: L(
          '    if (tab === "wallets") return handlers.onWallet();',
          '    if (tab === "installments") return handlers.onInstallment();',
        ),
      },
    ],
  },
  {
    file: "src/components/header.js",
    edits: [
      {
        find: '  wallets: "Wallets",',
        replace: '  wallets: "Wallets",\n  installments: "Installments",',
      },
    ],
  },
  {
    file: "src/main.js",
    edits: [
      {
        find: 'import { renderBills } from "./components/billsTab.js";',
        replace: L(
          'import { renderBills } from "./components/billsTab.js";',
          'import { renderInstallmentsTab } from "./components/installmentsTab.js";',
          "import {",
          "  initInstallmentSheets,",
          "  openInstallmentForm,",
          "  openInstallmentDetail,",
          '} from "./components/installmentSheet.js";',
          'import { getInstallment } from "./installments.js";',
          'import { initSortControl } from "./components/sortControl.js";',
        ),
      },
      {
        find: '    ${state.tab === "wallets" ? renderWalletsTab() : ""}',
        replace: L(
          '    ${state.tab === "wallets" ? renderWalletsTab() : ""}',
          '    ${state.tab === "installments" ? renderInstallmentsTab() : ""}',
        ),
      },
      {
        find: "  initWalletsTab(render);",
        replace: L(
          "  initWalletsTab(render);",
          "  initInstallmentSheets(render);",
          "  initSortControl(render); // one Sort control for every list",
        ),
      },
      {
        find: "    onWallet: () => openWalletForm(null),",
        replace: L(
          "    onWallet: () => openWalletForm(null),",
          "    onInstallment: () => openInstallmentForm(null),",
        ),
      },
      {
        find: '  document.querySelectorAll("[data-wallet]").forEach((row) => {',
        replace: L(
          "  // Installment rows appear in the Installments tab and the Overview card.",
          '  document.querySelectorAll("[data-installment]").forEach((row) => {',
          "    row.onclick = () => {",
          "      const plan = getInstallment(row.dataset.installment);",
          "      if (plan) openInstallmentDetail(plan);",
          "    };",
          "  });",
          "",
          '  document.querySelectorAll("[data-wallet]").forEach((row) => {',
        ),
      },
    ],
  },

  // ── Overview: this month's installment dues ────────────────────────────
  {
    file: "src/components/overview.js",
    edits: [
      {
        find: 'import { renderInsightsCard } from "../insights.js";',
        replace: L(
          'import { renderInsightsCard } from "../insights.js";',
          'import { renderInstallmentsDue } from "./installmentsTab.js";',
        ),
      },
      {
        find: "  ${renderUpcomingBills()}\n",
        replace: "  ${renderUpcomingBills()}\n  ${renderInstallmentsDue()}\n",
      },
    ],
  },
  {
    file: "src/components/householdActivitySheet.js",
    edits: [
      {
        find: "    default:\n      return `${verb} something`;",
        replace: L(
          '    case "kwenta_wallets":',
          '      return `${verb} a wallet: ${escapeHtml(d.name || "")}`;',
          '    case "kwenta_installments":',
          '      return `${verb} an installment: ${escapeHtml(d.name || "")}${d.monthlyAmount ? ` (${fmt(d.monthlyAmount)}/month)` : ""}`;',
          "    default:",
          "      return `${verb} something`;",
        ),
      },
    ],
  },

  // ── Sorting: Expenses, Income, Bills, Budgets, Utang ───────────────────
  {
    file: "src/components/expenses.js",
    edits: [
      {
        find: 'import { openExpenseCategoriesSheet } from "./expenseCategoriesSheet.js";',
        replace: L(
          'import { openExpenseCategoriesSheet } from "./expenseCategoriesSheet.js";',
          SORT_IMPORTS,
        ),
      },
      {
        find: '  return items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));',
        replace: '  return sortList("expenses", items);',
      },
      {
        find: "  ${renderToolbar()}\n",
        replace: '  ${renderToolbar()}\n  ${renderSortButton("expenses")}\n',
      },
    ],
  },
  {
    file: "src/components/income.js",
    edits: [
      {
        find: 'import { notifySyncError } from "../toast.js";',
        replace: L(
          'import { notifySyncError } from "../toast.js";',
          SORT_IMPORTS,
        ),
      },
      {
        regex:
          /const extras = monthTx\("income"\)\.sort\(\(a, b\) =>\s*\(b\.date \|\| ""\)\.localeCompare\(a\.date \|\| ""\),\s*\);/,
        replace: 'const extras = sortList("income", monthTx("income"));',
      },
      {
        find: '${extras.length === 1 ? "entry" : "entries"}</span></div>',
        replace:
          '${extras.length === 1 ? "entry" : "entries"}</span></div>\n  ${extras.length > 1 ? renderSortButton("income") : ""}',
      },
    ],
  },
  {
    file: "src/components/billsTab.js",
    edits: [
      {
        find: 'import { fmt, escapeHtml } from "../format.js";',
        replace: L(
          'import { fmt, escapeHtml } from "../format.js";',
          SORT_IMPORTS,
        ),
      },
      {
        regex:
          /const sorted = bills\.slice\(\)\.sort\(\(a, b\) => \{[\s\S]*?\n  \}\);/,
        replace:
          'const sorted = sortList("bills", bills, { monthKey: viewedMonthKey });',
      },
      {
        find: '<span class="sub">${bills.length} tracked</span></div>',
        replace:
          '<span class="sub">${bills.length} tracked</span></div>\n  ${renderSortButton("bills")}',
      },
    ],
  },
  {
    file: "src/components/budgets.js",
    edits: [
      {
        find: 'import { notifySyncError } from "../toast.js";',
        replace: L(
          'import { notifySyncError } from "../toast.js";',
          SORT_IMPORTS,
        ),
      },
      {
        find: "  const cats = visibleCategories();",
        replace:
          '  const cats = sortList("budgets", visibleCategories(), {\n    spent: spentByCategory(),\n  });',
      },
      {
        find: "  ${\n    cats.length === 0\n",
        replace:
          '  ${cats.length > 1 ? renderSortButton("budgets") : ""}\n  ${\n    cats.length === 0\n',
      },
    ],
  },
  {
    file: "src/components/loansTab.js",
    edits: [
      {
        find: 'import { goalAccentColor } from "./goalsTab.js";',
        replace: L(
          'import { goalAccentColor } from "./goalsTab.js";',
          SORT_IMPORTS,
        ),
      },
      {
        regex: /const rows = loans\s*\.map\(/,
        replace: "const unsorted = loans\n    .map(",
      },
      {
        regex:
          /\.sort\(\(a, b\) => \{\s*const aSettled[\s\S]*?localeCompare\(a\.loan\.date \|\| ""\);\s*\}\);/,
        replace: ';\n  const rows = sortList("loans", unsorted);',
      },
      {
        find: '<span class="sub">${loans.length} tracked</span></div>',
        replace:
          '<span class="sub">${loans.length} tracked</span></div>\n  ${loans.length > 1 ? renderSortButton("loans") : ""}',
      },
    ],
  },

  // ── Docs ───────────────────────────────────────────────────────────────
  {
    file: "README.md",
    edits: [
      {
        find: "## E-wallet & bank icons\n",
        replace: L(
          "## Installments (SPayLater)",
          "",
          "Tab **Overview → Installments**. A plan is a template (item name, total amount,",
          "monthly payment, total months, remaining months, and a due rule: the **15th** or",
          "the **last day** of the month, like Shopee SPayLater cycles). Logic is in",
          "`installments.js`; UI in `components/installmentsTab.js` and `installmentSheet.js`.",
          "",
          "- **Paying:** *Mark as paid* creates a real expense in the built-in",
          '  `installments` category ("Installments / SPayLater"), linked by',
          "  `installmentId` (column `kwenta_transactions.installment_id`), and lowers",
          '  `remainingMonths` by 1. Undo reverses both. "Month 2 of 6" is',
          "  `(totalMonths - remainingMonths) + 1`.",
          "- **In the budget/overview:** paid payments are ordinary expenses, so they are",
          "  in Net Balance, Expenses and the Installments budget category (set a limit",
          "  like any category). Overview has an **Installments** card with this month's",
          "  unpaid dues, due date and status; the tab shows *To pay this month* and",
          "  *Total still owed*.",
          "- **Deleting a plan** keeps the payments already recorded (same as bills).",
          "- Table `kwenta_installments` is shared in households, in realtime, the activity",
          "  log, backup/restore and account deletion (migration `20261113000000`).",
          "",
          "## Sorting",
          "",
          "`sorting.js` defines the options per list (Expenses, Income, Bills, Budgets,",
          "Utang, Installments). `sortList(viewId, items, ctx)` always returns a **copy**,",
          "so saved data is never reordered and nothing syncs. The choice is remembered",
          "per list on the device (`localStorage`, key `kwenta_sort_v1`, like theme and",
          "currency). The button and sheet are `components/sortControl.js`; call",
          "`renderSortButton(viewId)` in a tab's markup. To add a list: add a view to",
          "`SORT_VIEWS`, call `sortList` where it renders, add the button.",
          'Utang has no due date, so its "due/remaining" sort is by remaining balance.',
          "",
          "## E-wallet & bank icons",
          "",
        ),
      },
    ],
  },
];

// ── runner ───────────────────────────────────────────────────────────────
let failed = 0;
let applied = 0;
let skipped = 0;

for (const patch of PATCHES) {
  const abs = path.resolve(patch.file);
  if (!fs.existsSync(abs)) {
    console.log(`✗ ${patch.file} — file not found`);
    failed++;
    continue;
  }
  const raw = fs.readFileSync(abs, "utf8");
  const crlf = raw.includes("\r\n");
  let text = crlf ? raw.replace(/\r\n/g, "\n") : raw;
  const problems = [];

  patch.edits.forEach((edit, i) => {
    // Already applied? Most edits keep their `find` text inside the
    // replacement (they add lines next to it), so a second run would insert
    // everything again and break the build. An edit whose result (or `skipIf`
    // marker) is already in the file is skipped instead.
    if (text.includes(edit.skipIf ?? edit.replace)) {
      skipped++;
      return;
    }
    // matchAll counts whole matches; String.match() on a regex with a capture
    // group returns [full, group], which made a single match look like two.
    const got = edit.regex
      ? [...text.matchAll(new RegExp(edit.regex.source, "g"))].length
      : text.split(edit.find).length - 1;
    if (got !== 1) {
      problems.push(`edit ${i + 1}: expected 1 match, found ${got}`);
      return;
    }
    text = edit.regex
      ? text.replace(edit.regex, edit.replace)
      : text.split(edit.find).join(edit.replace);
  });

  if (problems.length) {
    console.log(
      `✗ ${patch.file} — left untouched\n    ${problems.join("\n    ")}`,
    );
    failed++;
    continue;
  }
  if (!dry) fs.writeFileSync(abs, crlf ? text.replace(/\n/g, "\r\n") : text);
  console.log(
    `✓ ${patch.file} — ${patch.edits.length} edit(s)${dry ? " (dry run)" : ""}`,
  );
  applied++;
}

console.log(
  `\n${applied} file(s) ${dry ? "would be " : ""}patched, ${failed} problem(s)` +
    (skipped ? `, ${skipped} edit(s) already applied and skipped.` : "."),
);
process.exit(failed ? 1 : 0);
