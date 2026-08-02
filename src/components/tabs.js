import { state } from '../state.js';

export const TAB_LIST = [
  ['overview', 'Overview'],
  ['income', 'Income'],
  ['expenses', 'Expenses'],
  ['budgets', 'Budgets'],
];

export function renderTabs() {
  return `
  <div class="tabs">
    ${TAB_LIST.map(([id, label]) => `<button class="tab-btn ${state.tab === id ? 'active' : ''}" data-tab="${id}">${label}</button>`).join('')}
  </div>`;
}
