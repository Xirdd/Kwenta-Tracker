#!/usr/bin/env node
// Applies the small, surgical edits from the review to files that were NOT
// re-delivered whole. Run from the repo root, AFTER copying the delivered
// files into place:
//
//   node scripts/apply-patches.mjs --dry   # check only, writes nothing
//   node scripts/apply-patches.mjs         # apply
//
// Safety: every edit must match EXACTLY the expected number of times. A file
// with any mismatch is left completely untouched and reported, so a partly
// patched file can never be produced. Re-running after a success reports
// "no match" for already-applied edits — that is expected and harmless.
// Delete this script (and the scripts/ folder if empty) once you've applied it.
//
// NOTE: src/state.js, src/backup.js, src/storage.js and a few other files
// were delivered WHOLE (full replacements) rather than as patches here,
// because they changed too much to patch safely. This script does not touch
// them.

import fs from "node:fs";
import path from "node:path";

const dry = process.argv.includes("--dry");
const L = (...lines) => lines.join("\n");

const FLASH_FN = (name) =>
  L(
    `function ${name}(id) {`,
    "  const el = document.getElementById(id);",
    '  el.style.borderColor = "var(--coral)";',
    "  setTimeout(() => {",
    '    el.style.borderColor = "transparent";',
    "  }, 700);",
    "}",
  );
const MODAL_IMPORT = 'import { openModal, closeModal } from "./modal.js";';

const PATCHES = [
  // ── Stored HTML injection: custom category names are written by other
  //    household members, so they must be escaped everywhere they're drawn.
  {
    file: "src/components/overview.js",
    edits: [
      {
        find: "<span>${c.label}${over ?",
        replace: "<span>${escapeHtml(c.label)}${over ?",
      },
    ],
  },
  // src/components/sheet.js is no longer patched here — it's delivered as a
  // complete file (it now also carries the wallet picker), so it already
  // includes the escapeHtml/flashField/todayISO fixes these edits used to add.
  {
    file: "src/components/shareIntakeSheet.js",
    edits: [
      {
        find: "${categoryIconBadge(c, 32)}${c.label}</div>",
        replace: "${categoryIconBadge(c, 32)}${escapeHtml(c.label)}</div>",
      },
      {
        find: 'import { uid, escapeHtml } from "../format.js";',
        replace: 'import { uid, escapeHtml, todayISO } from "../format.js";',
      },
      {
        find: "const today = new Date().toISOString().slice(0, 10);",
        replace: "const today = todayISO();",
      },
    ],
  },
  {
    file: "src/components/quickAddBar.js",
    edits: [
      {
        find: '<span class="label">${c.label}</span>',
        replace: '<span class="label">${escapeHtml(c.label)}</span>',
      },
      {
        find: 'import { openForm } from "./sheet.js";',
        replace: L(
          'import { openForm } from "./sheet.js";',
          'import { escapeHtml } from "../format.js";',
        ),
      },
    ],
  },
  {
    file: "src/components/billSheet.js",
    edits: [
      {
        find: "return bill.customCategory || catInfo(bill.category).label;",
        replace:
          "return escapeHtml(bill.customCategory || catInfo(bill.category).label);",
      },
      { find: L(FLASH_FN("flash"), "", ""), replace: "" },
      {
        find: MODAL_IMPORT,
        replace: L(
          MODAL_IMPORT,
          'import { flashField as flash } from "../dom.js";',
        ),
      },
    ],
  },
  {
    file: "src/components/goalSheet.js",
    edits: [
      {
        find: 'import { escapeHtml, fmt, formatDate } from "../format.js";',
        replace:
          'import { escapeHtml, fmt, formatDate, todayISO } from "../format.js";',
      },
      {
        find: "const today = new Date().toISOString().slice(0, 10);",
        replace: "const today = todayISO();",
      },
      { find: L(FLASH_FN("flash"), "", ""), replace: "" },
      {
        find: MODAL_IMPORT,
        replace: L(
          MODAL_IMPORT,
          'import { flashField as flash } from "../dom.js";',
        ),
      },
    ],
  },
  {
    file: "src/components/loanSheet.js",
    edits: [
      {
        find: 'import { escapeHtml, fmt, formatDate } from "../format.js";',
        replace:
          'import { escapeHtml, fmt, formatDate, todayISO } from "../format.js";',
      },
      {
        find: "const today = new Date().toISOString().slice(0, 10);",
        replace: "const today = todayISO();",
        count: 2,
      },
      { find: L(FLASH_FN("flash"), "", ""), replace: "" },
      {
        find: MODAL_IMPORT,
        replace: L(
          MODAL_IMPORT,
          'import { flashField as flash } from "../dom.js";',
        ),
      },
    ],
  },
  {
    file: "src/components/householdSheet.js",
    edits: [
      { find: L("", FLASH_FN("flash"), ""), replace: "" },
      {
        find: MODAL_IMPORT,
        replace: L(
          MODAL_IMPORT,
          'import { flashField as flash } from "../dom.js";',
        ),
      },
    ],
  },
  {
    file: "src/components/budgetCard.js",
    edits: [
      {
        find: 'import { fmt, escapeHtml } from "../format.js";',
        replace:
          'import { fmt, escapeHtml, currencySymbol } from "../format.js";',
      },
      {
        find: "<span>₱</span>",
        replace: "<span>${currencySymbol()}</span>",
        count: 2,
      },
    ],
  },

  // ── Search: bill results threw a ReferenceError (currentRealMonthKey was
  //    never imported); goal/utang transactions showed up as editable ghosts;
  //    dates were parsed as UTC.
  {
    file: "src/components/searchSheet.js",
    edits: [
      {
        find: 'import { DATA, state, periodKeyOf } from "../state.js";',
        replace:
          'import { DATA, state, periodKeyOf, isSeparatelyTracked } from "../state.js";',
      },
      {
        find: 'import { fmt, formatDate, escapeHtml } from "../format.js";',
        replace:
          'import { fmt, formatDate, escapeHtml, parseISODate } from "../format.js";',
      },
      {
        find: 'import { getBill } from "../bills.js";',
        replace: 'import { getBill, currentRealMonthKey } from "../bills.js";',
      },
      {
        find: ".filter((t) => t.type === type)",
        replace: ".filter((t) => t.type === type && !isSeparatelyTracked(t))",
      },
      {
        find: "state.monthKey = periodKeyOf(new Date(tx.date));",
        replace: "state.monthKey = periodKeyOf(parseISODate(tx.date));",
      },
      {
        find: '<div class="meta">${cat.label} · ${formatDate(tx.date)}</div>',
        replace:
          '<div class="meta">${escapeHtml(cat.label)} · ${formatDate(tx.date)}</div>',
      },
    ],
  },

  // ── Insights: trendTotals/totals were moved into state.js's own salaryFor()
  //    when state.js was re-delivered whole — insights.js still needs to call
  //    through it (rather than reading DATA.salary directly) so its savings-
  //    rate card agrees with the Overview totals after a period-mode switch.
  {
    file: "src/insights.js",
    edits: [
      {
        find: "  const salary = Number(DATA.salary[currentPeriod]) || 0;",
        replace: "  const salary = salaryFor(currentPeriod);",
      },
      {
        find: L("  budgetFor,", '} from "./state.js";'),
        replace: L("  budgetFor,", "  salaryFor,", '} from "./state.js";'),
      },
    ],
  },

  // ── Household: a custom category created by another member couldn't be
  //    deleted or correctly re-edited (same root cause as the sync.js fix —
  //    writes used the CURRENT user's id instead of the row's real owner).
  //    Also adds `userId` to loaded categories, which backup.js's household
  //    restore scoping depends on.
  {
    file: "src/customCategoriesCloud.js",
    edits: [
      {
        find: "    icon: r.icon || undefined, // missing -> categoryIcons.js falls back to the tag icon",
        replace: L(
          "    userId: r.user_id,",
          "    icon: r.icon || undefined, // missing -> categoryIcons.js falls back to the tag icon",
        ),
      },
      {
        find: L(
          "async function upsert(cat) {",
          "  const user = getCurrentUser();",
          "  if (!supabase || !user) return;",
          "  const row = {",
          "    id: cat.id,",
          "    user_id: user.id,",
        ),
        replace: L(
          "async function upsert(cat) {",
          "  const user = getCurrentUser();",
          "  if (!supabase || !user) return;",
          "  // The row belongs to whoever created it, even in a shared household —",
          "  // same rule as sync.js. Writing the CURRENT user's id instead let",
          "  // editing a housemate's category insert a second copy under your id.",
          "  const row = {",
          "    id: cat.id,",
          "    user_id: cat.userId || user.id,",
        ),
      },
      {
        find: L(
          "  // Scoped like loads are (household rows, or my own personal rows). The",
          "  // old `user_id = me` filter matched nothing for a category another",
          "  // household member created, so it silently came back on reload.",
          "  const householdId = getActiveHouseholdId();",
          '  let q = supabase.from("kwenta_custom_categories").delete().eq("id", id);',
          "  q = householdId",
          '    ? q.eq("household_id", householdId)',
          '    : q.eq("user_id", user.id).is("household_id", null);',
          "  const { error } = await q;",
        ),
        replace: null, // placeholder: see fallback edit below if this file wasn't patched before
      },
    ],
  },

  // ── 2FA setup: cancelling left a half-enrolled factor behind
  {
    file: "src/components/mfaSetupSheet.js",
    edits: [
      {
        find: L("  countRemainingRecoveryCodes,", '} from "../mfa.js";'),
        replace: L(
          "  countRemainingRecoveryCodes,",
          "  cancelEnrollment,",
          '} from "../mfa.js";',
        ),
      },
      {
        find: 'document.getElementById("mfaCancelBtn").onclick = closeModal;',
        replace: L(
          'document.getElementById("mfaCancelBtn").onclick = () => {',
          "    cancelEnrollment(enrollment.factorId); // don't leave an unverified factor behind",
          "    closeModal();",
          "  };",
        ),
      },
    ],
  },
  {
    file: "src/components/mfaChallengeSheet.js",
    edits: [
      {
        find: 'placeholder="XXXX-XXXX"',
        replace: 'placeholder="XXXXX-XXXXX"',
      },
    ],
  },

  // ── Sign out: stop the device receiving the previous account's pushes
  {
    file: "src/components/settingsTab.js",
    edits: [
      {
        find: 'import { openBackupSheet } from "./backupSheet.js";',
        replace: L(
          'import { openBackupSheet } from "./backupSheet.js";',
          'import { disablePush } from "../push.js";',
        ),
      },
      {
        find: "      await signOut(); // onAuthChange (main.js) handles the re-render + wipe",
        replace: L(
          "      // Remove this device's push subscription while still signed in (the",
          "      // row can't be deleted afterwards). Otherwise the device keeps getting",
          "      // this account's bill/budget notifications after sign-out. Time-boxed",
          "      // so a slow or missing service worker can never block signing out.",
          "      await Promise.race([",
          "        disablePush().catch(() => {}),",
          "        new Promise((resolve) => setTimeout(resolve, 2000)),",
          "      ]);",
          "      await signOut(); // onAuthChange (main.js) handles the re-render + wipe",
        ),
      },
    ],
  },

  // ── Household realtime: don't re-render under someone who is typing
  {
    file: "src/main.js",
    edits: [
      {
        find: L(
          "async function onHouseholdChanged() {",
          "  if (!isAuthorized()) return;",
        ),
        replace: L(
          "let householdReloadTimer = null;",
          "async function onHouseholdChanged() {",
          "  if (!isAuthorized()) return;",
          "  // Your own edits echo back through realtime. Re-rendering while a field",
          "  // is focused dropped the cursor mid-typing (e.g. a budget limit), so wait",
          "  // until the person has stopped.",
          "  const active = document.activeElement;",
          "  if (",
          "    active &&",
          "    /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) &&",
          '    document.getElementById("app")?.contains(active)',
          "  ) {",
          "    clearTimeout(householdReloadTimer);",
          "    householdReloadTimer = setTimeout(onHouseholdChanged, 1500);",
          "    return;",
          "  }",
        ),
      },
    ],
  },

  // ── Service worker: README and notices.js describe a "prompt" update flow,
  //    but the worker was set to auto-update, so the banner could never appear
  //    and a new version swapped in under a running page.
  {
    file: "src/sw.js",
    edits: [
      {
        find: 'registerType "autoUpdate"',
        replace: 'registerType "prompt"',
      },
      {
        find: L(
          "// A new worker activates immediately and takes control of open tabs, so a",
          '// deploy is picked up without a "refresh to update" prompt.',
        ),
        replace: L(
          "// A new worker downloads in the background and WAITS. notices.js shows an",
          '// "Update" banner; tapping it posts SKIP_WAITING (below) and reloads.',
        ),
      },
      {
        find: "self.skipWaiting();",
        replace: L(
          'self.addEventListener("message", (event) => {',
          '  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();',
          "});",
        ),
      },
    ],
  },
  {
    file: "vite.config.js",
    edits: [
      {
        find: 'registerType: "autoUpdate",',
        replace: 'registerType: "prompt",',
      },
      {
        find: "// The new service worker installs in the background, takes over on the",
        replace:
          "// A new service worker downloads in the background and waits; notices.js",
      },
      {
        find: "// next load, and old precaches get cleaned up — no update prompt needed.",
        replace:
          '// shows an "Update" banner, and sw.js activates it on SKIP_WAITING.',
      },
      {
        find: 'background_color: "#0e211b",',
        replace: 'background_color: "#0a1611",',
      },
      { find: 'theme_color: "#0e211b",', replace: 'theme_color: "#0a1611",' },
    ],
  },

  // ── supabase-js 2.111 requires Node >= 22 (see package-lock.json "engines")
  {
    file: "package.json",
    edits: [
      {
        find: '  "private": true,',
        replace: L(
          '  "private": true,',
          '  "engines": {',
          '    "node": ">=22"',
          "  },",
        ),
      },
    ],
  },

  // ── Wallets (GCash / GoTyme / Maribank / …): wire the new tab, FAB and
  //    detail-row handling into the existing screens.
  {
    file: "src/components/tabs.js",
    edits: [
      {
        find: L('  ["bills", "Bills"],', "];"),
        replace: L('  ["bills", "Bills"],', '  ["wallets", "Wallets"],', "];"),
      },
    ],
  },
  {
    file: "src/components/fabMenu.js",
    edits: [
      {
        find: L('    if (tab === "bills") return handlers.onBill();', "  };"),
        replace: L(
          '    if (tab === "bills") return handlers.onBill();',
          '    if (tab === "wallets") return handlers.onWallet();',
          "  };",
        ),
      },
    ],
  },
  {
    file: "src/household.js",
    edits: [
      {
        find: L('    "kwenta_goals",', '    "kwenta_loans",', "  ];"),
        replace: L(
          '    "kwenta_goals",',
          '    "kwenta_loans",',
          '    "kwenta_wallets",',
          "  ];",
        ),
      },
    ],
  },
  {
    file: "src/realtime.js",
    edits: [
      {
        find: L('  "kwenta_loans",', '  "kwenta_custom_categories",', "];"),
        replace: L(
          '  "kwenta_loans",',
          '  "kwenta_wallets",',
          '  "kwenta_custom_categories",',
          "];",
        ),
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
          'import { renderWalletsTab } from "./components/walletsTab.js";',
        ),
      },
      {
        find: L(
          "import {",
          "  initLoanSheets,",
          "  openLoanForm,",
          "  openLoanDetail,",
          '} from "./components/loanSheet.js";',
        ),
        replace: L(
          "import {",
          "  initLoanSheets,",
          "  openLoanForm,",
          "  openLoanDetail,",
          '} from "./components/loanSheet.js";',
          "import {",
          "  initWalletSheets,",
          "  openWalletForm,",
          "  openWalletDetail,",
          '} from "./components/walletSheet.js";',
          'import { getWallet } from "./wallets.js";',
        ),
      },
      {
        find: L(
          '    ${state.tab === "bills" ? renderBills() : ""}',
          "  `;",
          "}",
        ),
        replace: L(
          '    ${state.tab === "bills" ? renderBills() : ""}',
          '    ${state.tab === "wallets" ? renderWalletsTab() : ""}',
          "  `;",
          "}",
        ),
      },
      {
        find: "  initLoanSheets(render);\n  initBudgetsSheet(render);",
        replace:
          "  initLoanSheets(render);\n  initWalletSheets(render);\n  initBudgetsSheet(render);",
      },
      {
        find: L("    onLoan: () => openLoanForm(null),", "  });"),
        replace: L(
          "    onLoan: () => openLoanForm(null),",
          "    onWallet: () => openWalletForm(null),",
          "  });",
        ),
      },
      {
        find: L(
          '  document.querySelectorAll("[data-loan]").forEach((row) => {',
          "    row.onclick = () => {",
          "      const loan = getLoan(row.dataset.loan);",
          "      if (loan) openLoanDetail(loan);",
          "    };",
          "  });",
          "}",
        ),
        replace: L(
          '  document.querySelectorAll("[data-loan]").forEach((row) => {',
          "    row.onclick = () => {",
          "      const loan = getLoan(row.dataset.loan);",
          "      if (loan) openLoanDetail(loan);",
          "    };",
          "  });",
          "",
          '  document.querySelectorAll("[data-wallet]").forEach((row) => {',
          "    row.onclick = () => {",
          "      const wallet = getWallet(row.dataset.wallet);",
          "      if (wallet) openWalletDetail(wallet);",
          "    };",
          "  });",
          "}",
        ),
      },
    ],
  },

  // ── Dead CSS: the light / midnight / sepia / slate themes were removed
  //    (theme.js only offers the five dark ones), but their blocks remained.
  {
    file: "src/style.css",
    edits: [
      {
        regex:
          /\/\* (?:Light|Midnight|Sepia|Slate):[^\n]*\*\/\n\[data-theme="[a-z]+"\] \{[^}]*\}\n/g,
        replace: "",
        count: 4,
      },
    ],
  },
];

// The customCategoriesCloud.js delete-scoping edit's `replace` target can't
// be written as a literal here without risking a double-edit if you already
// applied an earlier version of this script. Handle it as its own patch
// with a safe, self-checking pair of alternatives instead.
const CC_DELETE_OLD = L(
  "  const { error } = await supabase",
  '    .from("kwenta_custom_categories")',
  "    .delete()",
  '    .eq("user_id", user.id)',
  '    .eq("id", id);',
);
const CC_DELETE_NEW = L(
  "  // Scoped like loads are (household rows, or my own personal rows). The",
  "  // old `user_id = me` filter matched nothing for a category another",
  "  // household member created, so it silently came back on reload.",
  "  const householdId = getActiveHouseholdId();",
  '  let q = supabase.from("kwenta_custom_categories").delete().eq("id", id);',
  "  q = householdId",
  '    ? q.eq("household_id", householdId)',
  '    : q.eq("user_id", user.id).is("household_id", null);',
  "  const { error } = await q;",
);
// Remove the placeholder edit above and attach the real one here instead.
PATCHES.find((p) => p.file === "src/customCategoriesCloud.js").edits =
  PATCHES.find((p) => p.file === "src/customCategoriesCloud.js").edits.filter(
    (e) => e.replace !== null,
  );
PATCHES.find((p) => p.file === "src/customCategoriesCloud.js").edits.push({
  find: CC_DELETE_OLD,
  replace: CC_DELETE_NEW,
});

// Files removed because nothing imports them any more.
const DELETE = [
  // Replaced by the full-page login in components/authPage.js; not imported anywhere.
  "src/components/authSheet.js",
];

// ── runner ───────────────────────────────────────────────────────────────
let failed = 0;
let applied = 0;

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
    const want = edit.count ?? 1;
    const got = edit.regex
      ? (text.match(edit.regex) || []).length
      : text.split(edit.find).length - 1;
    if (got !== want) {
      problems.push(`edit ${i + 1}: expected ${want} match(es), found ${got}`);
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

for (const file of DELETE) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) {
    console.log(`– ${file} — already gone`);
    continue;
  }
  if (!dry) fs.rmSync(abs);
  console.log(`✓ ${file} — deleted${dry ? " (dry run)" : ""}`);
}

console.log(
  `\n${applied} file(s) ${dry ? "would be " : ""}patched, ${failed} problem(s).`,
);
process.exit(failed ? 1 : 0);
