const CURRENCY_KEY = "kwenta_currency";

// Deliberately NOT real multi-currency (no exchange rates, no conversion) —
// this only changes how numbers are *displayed*. Every amount in the app is
// still just a plain number in Supabase; switching this doesn't convert
// anything, it just formats the same number with a different symbol and
// locale-appropriate grouping/decimals. A person with ₱50,000 saved who
// switches this to USD sees "$50,000.00", not the equivalent in dollars —
// worth being upfront about, since that's an easy thing to misread as
// currency conversion at a glance.
//
// decimals defaults to 2 if omitted; JPY is a real exception (yen has no
// subdivision, "¥1,000.00" looks wrong to anyone used to it).
export const CURRENCIES = [
  { id: "php", label: "Philippine Peso", symbol: "₱", locale: "en-US" },
  { id: "usd", label: "US Dollar", symbol: "$", locale: "en-US" },
  { id: "eur", label: "Euro", symbol: "€", locale: "de-DE" },
  { id: "gbp", label: "British Pound", symbol: "£", locale: "en-GB" },
  {
    id: "jpy",
    label: "Japanese Yen",
    symbol: "¥",
    locale: "ja-JP",
    decimals: 0,
  },
  { id: "sgd", label: "Singapore Dollar", symbol: "S$", locale: "en-SG" },
  { id: "aud", label: "Australian Dollar", symbol: "A$", locale: "en-AU" },
  { id: "cad", label: "Canadian Dollar", symbol: "C$", locale: "en-CA" },
];
const CURRENCY_IDS = CURRENCIES.map((c) => c.id);
const DEFAULT_ID = "php"; // Kwenta's own default/native currency

function getStoredCurrencyId() {
  try {
    return localStorage.getItem(CURRENCY_KEY);
  } catch (e) {
    return null;
  }
}

function storeCurrencyId(id) {
  try {
    localStorage.setItem(CURRENCY_KEY, id);
  } catch (e) {
    /* ignore */
  }
}

export function currentCurrencyId() {
  const stored = getStoredCurrencyId();
  return stored && CURRENCY_IDS.includes(stored) ? stored : DEFAULT_ID;
}

export function currentCurrencyConfig() {
  return CURRENCIES.find((c) => c.id === currentCurrencyId()) || CURRENCIES[0];
}

export function setCurrency(id) {
  if (!CURRENCY_IDS.includes(id)) return;
  storeCurrencyId(id);
}

// A per-device preference, same as theme.js — not synced to Supabase, so
// switching devices resets it to the default (₱). If you want it to follow
// the person across devices instead, it'd need to move into kwenta_salary's
// pattern (a real column, synced like everything else) rather than
// localStorage — a bigger change than this pass covers.
