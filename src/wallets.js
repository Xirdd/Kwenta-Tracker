import { DATA, saveData } from "./state.js";
import { uid } from "./format.js";
import { sumPesos } from "./money.js";
import {
  isCloudMode,
  cloudUpsertWallet,
  cloudDeleteWallet,
  cloudUpsertTransaction,
  cloudDeleteTransaction,
} from "./sync.js";
import { notifySyncError } from "./toast.js";

// Brand-ish colors only — not pixel-exact logos, just enough that GCash
// reads as "that blue one" at a glance, the way categories.js's palette
// works. "Bank account" and "Cash" cover anything that isn't one of the
// three named e-wallets; "Other" is the catch-all.
//
// `icon` is an id from icons/categoryIcons.js (the "E-wallets & banks" group):
// original monogram marks, not the companies' official logos.
export const WALLET_PROVIDERS = [
  { id: "gcash", label: "GCash", color: "#0072CE", icon: "gcash" },
  { id: "maya", label: "Maya", color: "#1FBF75", icon: "maya" },
  { id: "gotyme", label: "GoTyme", color: "#6C2EB5", icon: "gotyme" },
  { id: "maribank", label: "Maribank", color: "#00A79D", icon: "maribank" },
  { id: "bank", label: "Bank account", color: "#5b7fde", icon: "bank" },
  { id: "cash", label: "Cash", color: "#3fa377", icon: "banknote" },
  { id: "other", label: "Other wallet", color: "#8c8c7a", icon: "wallet" },
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

// `shared` (default true) only matters while you're in a household: a shared
// wallet is visible to, and usable by, everyone in it; a private one (shared:
// false) is saved with no household, so only you can see or pick it. Outside a
// household the flag has no effect.
export function createWallet({ name, provider, startingBalance, shared }) {
  const wallet = {
    id: uid("w"),
    shared: shared !== false,
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

export function updateWallet(
  wallet,
  { name, provider, startingBalance, shared },
) {
  wallet.name = name;
  if (shared !== undefined) wallet.shared = !!shared;
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

// ── Transfers between wallets ──────────────────────────────────────────
// A transfer is two ordinary, linked transactions sharing a `transferId` —
// an expense leaving the source wallet and an income arriving in the
// destination wallet — rather than a new kind of record. That's what lets
// each wallet's own balance() math (above) stay simple: it just sums
// income/expense per wallet, same as any other transaction.
//
// Both legs are marked "separately tracked" (see isSeparatelyTracked in
// state.js), the same mechanism goal contributions and utang payments
// already use — so a transfer moves money between YOUR OWN wallets without
// ever inflating your real income/expense totals, category breakdowns, or
// Insights. It's not new money and not real spending.
export function createTransfer({
  fromWalletId,
  toWalletId,
  amount,
  date,
  note,
}) {
  const from = getWallet(fromWalletId);
  const to = getWallet(toWalletId);
  if (!from || !to || from.id === to.id || !(Number(amount) > 0)) return null;

  const transferId = uid("xfer");
  const outTx = {
    id: uid(),
    type: "expense",
    desc: note || `Transfer to ${to.name}`,
    amount: Number(amount),
    category: "other",
    date,
    walletId: from.id,
    transferId,
  };
  const inTx = {
    id: uid(),
    type: "income",
    desc: note || `Transfer from ${from.name}`,
    amount: Number(amount),
    category: "other",
    date,
    walletId: to.id,
    transferId,
  };
  DATA.transactions.push(outTx, inTx);
  saveData();
  if (isCloudMode()) {
    cloudUpsertTransaction(outTx).catch((e) => notifySyncError(e));
    cloudUpsertTransaction(inTx).catch((e) => notifySyncError(e));
  }
  return { outTx, inTx };
}

// Removes both legs of a transfer together — there's no reason to ever have
// only one half of a transfer on its own.
export function removeTransfer(transferId) {
  const linked = DATA.transactions.filter((t) => t.transferId === transferId);
  DATA.transactions = DATA.transactions.filter(
    (t) => t.transferId !== transferId,
  );
  saveData();
  if (isCloudMode()) {
    linked.forEach((t) =>
      cloudDeleteTransaction(t.id).catch((e) => notifySyncError(e)),
    );
  }
}

// One row per transfer (its two linked transactions collapsed into one),
// newest first — for the "Recent transfers" list on the Wallets tab.
export function recentTransfers(limit = 10) {
  const byId = new Map();
  DATA.transactions
    .filter((t) => t.transferId)
    .forEach((t) => {
      const entry = byId.get(t.transferId) || {
        transferId: t.transferId,
        date: t.date,
        amount: t.amount,
      };
      if (t.type === "expense") entry.fromWalletId = t.walletId;
      else entry.toWalletId = t.walletId;
      byId.set(t.transferId, entry);
    });
  return [...byId.values()]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, limit);
}
