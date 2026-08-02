import "./style.css";

import { state, DATA, initData, shiftMonth, totals } from "./state.js";
import { renderHeader } from "./components/header.js";
import { renderMonthNav } from "./components/monthNav.js";
import { renderLedgerCard } from "./components/ledgerCard.js";
import { renderTabs } from "./components/tabs.js";
import { renderOverview } from "./components/overview.js";
import { renderIncome, attachIncomeEvents } from "./components/income.js";
import { renderExpenses } from "./components/expenses.js";
import { renderBudgets, attachBudgetEvents } from "./components/budgets.js";
import { initSheet, openForm } from "./components/sheet.js";
import { exportCSV } from "./export.js";

function render() {
  const t = totals();
  const app = document.getElementById("app");
  app.innerHTML = `
    ${renderHeader()}
    <div class="side">
      ${renderMonthNav()}
      ${renderLedgerCard(t)}
      ${renderTabs()}
    </div>
    <div class="content-panel">
      ${state.tab === "overview" ? renderOverview(t) : ""}
      ${state.tab === "income" ? renderIncome(t) : ""}
      ${state.tab === "expenses" ? renderExpenses(t) : ""}
      ${state.tab === "budgets" ? renderBudgets(t) : ""}
    </div>
  `;
  app.insertAdjacentHTML(
    "beforeend",
    `<button class="fab" id="fabBtn">+</button>`,
  );
  attachEvents();
}

function attachEvents() {
  document.getElementById("prevMonth").onclick = () => {
    shiftMonth(-1);
    render();
  };
  document.getElementById("nextMonth").onclick = () => {
    shiftMonth(1);
    render();
  };

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.onclick = () => {
      state.tab = btn.dataset.tab;
      render();
    };
  });

  document.getElementById("fabBtn").onclick = () => {
    const type = state.tab === "income" ? "income" : "expense";
    openForm(type, null);
  };

  document.getElementById("exportBtn").onclick = exportCSV;

  attachIncomeEvents();
  attachBudgetEvents();

  document.querySelectorAll("[data-edit]").forEach((row) => {
    row.onclick = () => {
      const id = row.dataset.edit;
      const type = row.dataset.type;
      const tx = DATA.transactions.find((t) => t.id === id);
      if (tx) openForm(type, tx);
    };
  });
}

(function init() {
  initSheet(render); // let the sheet module trigger a re-render after save/delete
  document.getElementById("app").innerHTML =
    `<div style="padding:60px 10px;text-align:center;color:#8fa093;font-family:Inter,sans-serif;font-size:13px;">Opening the ledger…</div>`;
  initData();
  render();
})();
