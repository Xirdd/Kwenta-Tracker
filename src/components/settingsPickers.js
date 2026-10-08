import "./optionList.css";
import { openModal, closeModal } from "./modal.js";
import { escapeHtml } from "../format.js";
import { currentTheme, setTheme, THEMES } from "../theme.js";
import { PERIOD_MODES, getPeriodMode, setPeriodMode } from "../periodMode.js";
import { currentCurrencyId, setCurrency, CURRENCIES } from "../currency.js";
import { state, periodKeyOf } from "../state.js";
import { materializeMonth } from "../recurring.js";

// "Tap a setting, pick from a sheet." Every configurable preference — theme,
// budget period, currency — is hidden behind its own row on the Settings
// screen and chosen here, in a bottom sheet with one tappable row per option.
// Each opener takes `onChange` (the app's re-render) and calls it after a pick.

const CHECK = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

// options: [{ id, label, sub?, leading? (trusted HTML) }]
function openOptionSheet({ title, hint, options, selectedId, onPick }) {
  openModal(`
    <div class="grabber"></div>
    <h3>${escapeHtml(title)}</h3>
    ${hint ? `<p class="auth-message">${escapeHtml(hint)}</p>` : ""}
    <div class="opt-list" role="radiogroup" aria-label="${escapeHtml(title)}">
      ${options
        .map(
          (o) => `
        <button type="button" class="opt-row ${o.id === selectedId ? "selected" : ""}" role="radio" aria-checked="${o.id === selectedId}" data-opt="${escapeHtml(o.id)}">
          ${o.leading || ""}
          <span class="opt-text">
            <span class="opt-label">${escapeHtml(o.label)}</span>
            ${o.sub ? `<span class="opt-sub">${escapeHtml(o.sub)}</span>` : ""}
          </span>
          <span class="opt-check">${CHECK}</span>
        </button>`,
        )
        .join("")}
    </div>
    <div class="sheet-actions">
      <button class="btn btn-ghost" id="optCancelBtn">Cancel</button>
    </div>
  `);

  document.getElementById("optCancelBtn").onclick = closeModal;
  document.querySelectorAll("[data-opt]").forEach((btn) => {
    btn.onclick = () => onPick(btn.dataset.opt);
  });
}

export function openThemePicker(onChange) {
  openOptionSheet({
    title: "Appearance",
    hint: "Changes the background tone only — income stays green and expenses stay coral in every theme.",
    selectedId: currentTheme(),
    options: THEMES.map((t) => ({
      id: t.id,
      label: t.label,
      // t.bg / t.paper are fixed hex values from theme.js, never user input.
      leading: `<span class="opt-swatch" style="background:${t.bg};"><i style="background:${t.paper};"></i></span>`,
    })),
    onPick: (id) => {
      setTheme(id);
      closeModal();
      onChange();
    },
  });
}

export function openPeriodPicker(onChange) {
  openOptionSheet({
    title: "Budget period",
    hint: "Pick whichever matches how you actually budget. Bills and Goals always stay monthly either way.",
    selectedId: getPeriodMode(),
    options: PERIOD_MODES.map((m) => ({
      id: m.id,
      label: m.label,
      sub: m.sub,
    })),
    onPick: (id) => {
      if (id !== getPeriodMode()) {
        setPeriodMode(id);
        // Jump the viewed period to "today" in the new shape right away, so
        // Overview/Income/Expenses/Budgets are never left on a stale-shaped
        // key, then create this period's recurring entries before rendering.
        state.monthKey = periodKeyOf(new Date());
        materializeMonth(state.monthKey);
      }
      closeModal();
      onChange();
    },
  });
}

export function openCurrencyPicker(onChange) {
  openOptionSheet({
    title: "Currency",
    hint: "Changes how amounts are displayed only — it doesn't convert anything.",
    selectedId: currentCurrencyId(),
    options: CURRENCIES.map((c) => ({
      id: c.id,
      label: c.label,
      leading: `<span class="opt-sym" aria-hidden="true">${escapeHtml(c.symbol)}</span>`,
    })),
    onPick: (id) => {
      setCurrency(id);
      closeModal();
      onChange(); // re-render so every amount on screen updates immediately
    },
  });
}
