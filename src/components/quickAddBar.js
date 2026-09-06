import { DATA, monthTx } from "../state.js";
import { CATEGORIES, catInfo, categoryIconBadge } from "../categories.js";
import { openForm } from "./sheet.js";

// A curated fallback so a brand-new account still gets useful chips before
// any spending history exists.
const DEFAULT_CATS = ["food", "transport", "bills", "load", "shopping"];

// Ranks categories by how often they're actually used (all-time, not just
// this month, so the row stays stable and useful even in a slow month),
// falling back to DEFAULT_CATS to fill any remaining slots.
function topCategories(limit = 6) {
  const counts = {};
  DATA.transactions.forEach((t) => {
    if (t.type !== "expense") return;
    counts[t.category] = (counts[t.category] || 0) + 1;
  });
  const ranked = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const merged = [...ranked, ...DEFAULT_CATS].filter(
    (id, i, arr) => arr.indexOf(id) === i,
  );
  return merged.slice(0, limit).map(catInfo);
}

// Renders nothing (returns "") when there's no point showing the row —
// keeps this optional rather than forcing itself into every screen.
export function renderQuickAddBar() {
  const cats = topCategories();
  if (cats.length === 0) return "";

  return `
  <div class="quick-add-row" id="quickAddRow">
    ${cats
      .map(
        (c) => `
      <div class="quick-add-chip" data-quick-cat="${c.id}">
        ${categoryIconBadge(c, 26)}
        <span class="label">${c.label}</span>
      </div>`,
      )
      .join("")}
  </div>`;
}

export function attachQuickAddEvents() {
  document.querySelectorAll("[data-quick-cat]").forEach((chip) => {
    chip.onclick = () => {
      // Opens the normal expense sheet with the category already picked —
      // the person only has to type an amount and hit save.
      openForm("expense", null, chip.dataset.quickCat);
    };
  });
}
