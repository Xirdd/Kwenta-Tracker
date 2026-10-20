import { escapeHtml } from "../format.js";
import { activeWallets } from "../wallets.js";

// The "Wallet" dropdown shared by the expense/income form and the bill
// payment sheet, so both read the same and a new wallet appears in both.
// Returns "" when there are no wallets, so the field simply isn't shown.
// Wallet ids come from the database, so they're escaped like everything else
// that lands in an attribute.
export function walletField(selectedId, { id = "fWallet", label } = {}) {
  const wallets = activeWallets();
  if (wallets.length === 0) return "";
  return `
    <div class="field">
      <label>${label || "Wallet"} <span class="opt">(optional — GCash, Maya, GoTyme, etc.)</span></label>
      <select id="${escapeHtml(id)}">
        <option value="">Not tracked</option>
        ${wallets
          .map(
            (w) =>
              `<option value="${escapeHtml(w.id)}" ${w.id === selectedId ? "selected" : ""}>${escapeHtml(w.name)}</option>`,
          )
          .join("")}
      </select>
    </div>`;
}
