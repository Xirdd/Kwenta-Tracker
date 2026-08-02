import { state, monthLabel } from '../state.js';

export function renderMonthNav() {
  return `
  <div class="month-nav">
    <button id="prevMonth">‹</button>
    <span class="month-label">${monthLabel(state.monthKey)}</span>
    <button id="nextMonth">›</button>
  </div>`;
}
