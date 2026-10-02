import { ICON_GROUPS } from "../icons/categoryIcons.js";

// Markup for the grouped icon grid. Selection state lives in the caller (the
// category form) — this only renders and reports taps, so it can be reused
// anywhere an icon needs choosing.
export function renderIconPicker(selectedId) {
  return `
  <div class="icon-picker" id="iconPicker">
    ${ICON_GROUPS.map(
      (g) => `
      <div class="icon-group-label">${g.label}</div>
      <div class="icon-grid">
        ${g.icons
          .map(
            (i) => `
          <button type="button" class="icon-opt ${i.id === selectedId ? "selected" : ""}" data-icon="${i.id}" title="${i.label}" aria-label="${i.label}" aria-pressed="${i.id === selectedId}">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${i.paths}</svg>
          </button>`,
          )
          .join("")}
      </div>`,
    ).join("")}
  </div>`;
}

// onSelect(iconId) fires on every tap; the selected highlight updates here.
export function attachIconPicker(onSelect) {
  document.querySelectorAll("#iconPicker .icon-opt").forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll("#iconPicker .icon-opt").forEach((b) => {
        b.classList.remove("selected");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("selected");
      btn.setAttribute("aria-pressed", "true");
      onSelect(btn.dataset.icon);
    };
  });
}
