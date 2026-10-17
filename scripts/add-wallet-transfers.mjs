#!/usr/bin/env node
// One-off patch for the wallet-transfer feature. Run AFTER copying in:
//   src/wallets.js (updated), src/components/walletsTab.js (updated),
//   src/components/transferSheet.js (new)
//
//   node scripts/add-wallet-transfers.mjs --dry
//   node scripts/add-wallet-transfers.mjs
//
// Same safety rule as the other patch scripts: every edit must match
// exactly once, or the whole file is left untouched and reported.

import fs from "node:fs";
import path from "node:path";

const dry = process.argv.includes("--dry");
const L = (...lines) => lines.join("\n");

const PATCHES = [
  {
    file: "src/state.js",
    edits: [
      {
        find: "export function isSeparatelyTracked(tx) {\n  return !!(tx.goalId || tx.loanId);\n}",
        replace:
          "export function isSeparatelyTracked(tx) {\n  return !!(tx.goalId || tx.loanId || tx.transferId);\n}",
      },
    ],
  },
  {
    file: "src/main.js",
    edits: [
      {
        find: 'import { renderWalletsTab } from "./components/walletsTab.js";',
        replace: L(
          "import {",
          "  renderWalletsTab,",
          "  initWalletsTab,",
          "  attachWalletsEvents,",
          '} from "./components/walletsTab.js";',
          'import { initTransferSheet } from "./components/transferSheet.js";',
        ),
      },
      {
        find: "  initLoanSheets(render);\n  initWalletSheets(render);\n  initBudgetsSheet(render);",
        replace:
          "  initLoanSheets(render);\n  initWalletSheets(render);\n  initWalletsTab(render);\n  initTransferSheet(render);\n  initBudgetsSheet(render);",
      },
      {
        find: "  attachQuickAddEvents();",
        replace: "  attachQuickAddEvents();\n  attachWalletsEvents();",
      },
    ],
  },
];

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
    const got = text.split(edit.find).length - 1;
    if (got !== 1) {
      problems.push(`edit ${i + 1}: expected 1 match, found ${got}`);
      return;
    }
    text = text.split(edit.find).join(edit.replace);
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
  `\n${applied} file(s) ${dry ? "would be " : ""}patched, ${failed} problem(s).`,
);
process.exit(failed ? 1 : 0);
