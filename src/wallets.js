import { DATA, saveData } from "./state.js";
import { uid } from "./format.js";
import { sumPesos } from "./money.js";
import {
  isCloudMode,
  cloudUpsertWallet,
  cloudDeleteWallet,
  cloudUpsertTransaction,
} from "./sync.js";
import { notifySyncError } from "./toast.js";

// Brand-ish colors only — not pixel-exact logos, just enough that GCash
// reads as "that blue one" at a glance, the way categories.js's palette
// works. "Bank account" and "Cash" cover anything that isn't one of the
// three named e-wallets; "Other" is the catch-all.
export const WALLET_PROVIDERS = [
  { id: "gcash", label: "GCash", color: "#0072CE" },
  { id: "gotyme", label: "GoTyme", color: "#6C2EB5" },
  { id: "maribank", label: "Maribank", color: "#00A79D" },
  { id: "bank", label: "Bank account", color: "#5b7fde" },
  { id: "cash", label: "Cash", color: "#3fa377" },
  { id: "other", label: "Other wallet", color: "#8c8c7a" },
];
const PROVIDER_IDS = WALLET_PROVIDERS.map((p) => p.id);

export function providerInfo(id) {
  return (
    WALLET_PROVIDERS.find((p) => p.id === id) ||
    WALLET_PROVIDERS[WALLET_PROVIDERS.length - 1]
  );
}

export function getWallet(id) {
  return DATA.wallets.find((w) => w.id === id);
}

// Only wallets still around are offered when logging a transaction — a
// deleted wallet's past entries just lose their wallet tag (see
// deleteWallet below), so there's nothing stale to filter out there.
export function activeWallets() {
  return DATA.wallets.filter((w) => w.active !== false);
}

export function createWallet({ name, provider, startingBalance }) {
  const wallet = {
    id: uid("w"),
    name,
    provider: PROVIDER_IDS.includes(provider) ? provider : "other",
    startingBalance: Number(startingBalance) || 0,
    active: true,
  };
  DATA.wallets.push(wallet);
  saveData();
  if (isCloudMode()) cloudUpsertWallet(wallet).catch((e) => notifySyncError(e));
  return wallet;
}

export function updateWallet(wallet, { name, provider, startingBalance }) {
  wallet.name = name;
  wallet.provider = PROVIDER_IDS.includes(provider) ? provider : "other";
  wallet.startingBalance = Number(startingBalance) || 0;
  saveData();
  if (isCloudMode()) cloudUpsertWallet(wallet).catch((e) => notifySyncError(e));
}

// Deleting a wallet does NOT touch its transactions — unlike a goal or loan,
// a transaction here is an independent record that the wallet only labels.
// Each one is simply unassigned (walletId cleared), so it keeps showing up
// everywhere it already did; it just stops counting toward this wallet.
export function deleteWallet(id) {
  DATA.wallets = DATA.wallets.filter((w) => w.id !== id);
  const affected = DATA.transactions.filter((t) => t.walletId === id);
  affected.forEach((t) => {
    t.walletId = undefined;
  });
  saveData();
  if (isCloudMode()) {
    cloudDeleteWallet(id).catch((e) => notifySyncError(e));
    affected.forEach((t) =>
      cloudUpsertTransaction(t).catch((e) => notifySyncError(e)),
    );
  }
}

export function transactionsForWallet(walletId) {
  return DATA.transactions
    .filter((t) => t.walletId === walletId)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

// A wallet's balance isn't scoped to the viewed period — it's "what's
// actually in GCash right now" — so this sums every transaction EVER
// assigned to it, across all time. Goal and utang transactions count too:
// money genuinely left or arrived at that wallet for those as well, even
// though they're excluded from the budgeting totals elsewhere in the app.
export function walletBalance(wallet) {
  const assigned = DATA.transactions.filter((t) => t.walletId === wallet.id);
  const income = sumPesos(
    assigned.filter((t) => t.type === "income"),
    (t) => t.amount,
  );
  const expense = sumPesos(
    assigned.filter((t) => t.type === "expense"),
    (t) => t.amount,
  );
  return wallet.startingBalance + income - expense;
}

export function totalWalletBalance() {
  return sumPesos(DATA.wallets, (w) => walletBalance(w));
}
