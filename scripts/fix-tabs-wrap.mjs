#!/usr/bin/env node
// One-off patch: lets the Overview sub-tab row (Overview/Income/Expenses/
// Budgets/Bills/Wallets) wrap onto a second line on narrow screens instead
// of silently overflowing sideways with no visible scrollbar — which is
// why the new Wallets tab existed in the DOM but was never visible.
//
//   node scripts/fix-tabs-wrap.mjs --dry
//   node scripts/fix-tabs-wrap.mjs

import fs from "node:fs";
import path from "node:path";

const dry = process.argv.includes("--dry");
const file = "src/style.css";
const abs = path.resolve(file);

if (!fs.existsSync(abs)) {
  console.log(`✗ ${file} — file not found`);
  process.exit(1);
}

const raw = fs.readFileSync(abs, "utf8");
const crlf = raw.includes("\r\n");
let text = crlf ? raw.replace(/\r\n/g, "\n") : raw;

const OLD = `.tabs {
  display: flex;
  gap: 4px;
  margin: 24px 2px 18px 2px;
  background: color-mix(in srgb, var(--bg-2) 55%, transparent);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-radius: var(--radius-sm);
  padding: 4px;
  border: 1px solid var(--line-dark);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}`;

const NEW = `.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 24px 2px 18px 2px;
  background: color-mix(in srgb, var(--bg-2) 55%, transparent);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-radius: var(--radius-sm);
  padding: 4px;
  border: 1px solid var(--line-dark);
  /* Was a single-row, scroll-to-see-more strip with its scrollbar hidden —
     once a 6th tab (Wallets) didn't fit, it was invisible with no visual
     hint that there was more to scroll to. Wrapping is more honest: every
     tab is always on screen, it just takes a second row when needed. */
}`;

const count = text.split(OLD).length - 1;
if (count !== 1) {
  console.log(
    `✗ ${file} — expected 1 match, found ${count}. Left untouched; paste me the .tabs block from your style.css and I'll adjust.`,
  );
  process.exit(1);
}
text = text.split(OLD).join(NEW);

if (!dry) fs.writeFileSync(abs, crlf ? text.replace(/\n/g, "\r\n") : text);
console.log(`✓ ${file} — 1 edit(s)${dry ? " (dry run)" : ""}`);
