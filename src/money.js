// All money in Kwenta is stored and calculated as INTEGER CENTAVOS
// (₱100.50 -> 10050). Floats only ever appear at the edges: what a person
// types into an input, what Supabase's numeric columns return, and the final
// formatted string shown on screen.

const PHP_FORMATTER = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

// Pesos (number or numeric string, e.g. an <input> value) -> integer centavos.
//
// Not a bare Math.round(n * 100): 1.005 * 100 is 100.49999999999999, so that
// would round to 100 instead of 101, and 4.35 * 100 is 434.99999999999994.
// Shifting the decimal point in the string form ("1.005e2" -> 100.5) avoids
// the binary-float multiply entirely.
export function pesosToCentavos(amount) {
  if (amount === null || amount === undefined || amount === "") return 0;
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;

  const sign = n < 0 ? -1 : 1;
  const abs = Math.abs(n);
  const str = String(abs);
  // Very large/small numbers stringify in exponent form ("1e-7") — the string
  // trick can't be applied there, so fall back to plain rounding.
  const centavos = str.includes("e")
    ? Math.round(abs * 100)
    : Math.round(Number(str + "e2"));
  return sign * centavos || 0; // `|| 0` turns -0 into 0
}

// Integer centavos -> pesos as a number. Use for <input> values and for
// writing to Supabase's numeric columns — never do arithmetic on the result.
export function centavosToPesos(centavos) {
  const n = Number(centavos);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n) / 100;
}

// Integer centavos -> "₱1,234.50" (negatives render as "-₱1,234.50").
export function formatPHP(centavos) {
  return PHP_FORMATTER.format(centavosToPesos(centavos));
}

// Integer centavos -> plain "1234.50" string, built with integer math only.
// For CSV export, where a currency symbol and thousands separators would get
// in the way of opening the file in a spreadsheet.
export function centavosToDecimalString(centavos) {
  const c = asCentavos(centavos);
  const sign = c < 0 ? "-" : "";
  const abs = Math.abs(c);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

// Coerces anything (undefined, "", a stray float) into a whole number of
// centavos. Used at every summation so one bad value can't reintroduce
// fractions into a total.
export function asCentavos(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

// Sums integer centavos. `pick` extracts the amount from each item.
export function sumCentavos(items, pick = (x) => x) {
  let total = 0;
  for (const item of items) total += asCentavos(pick(item));
  return total;
}

// One-time converter for data saved BEFORE the centavos change (peso floats):
// old localStorage data, old cloud-shaped objects, and version-1 backup files.
export function dataPesosToCentavos(d = {}) {
  const mapValues = (obj) =>
    Object.fromEntries(
      Object.entries(obj || {}).map(([k, v]) => [
        k,
        v === null || v === undefined ? v : pesosToCentavos(v),
      ]),
    );

  return {
    salary: mapValues(d.salary),
    transactions: (d.transactions || []).map((t) => ({
      ...t,
      amount: pesosToCentavos(t.amount),
    })),
    budgets: mapValues(d.budgets),
    recurring: (d.recurring || []).map((r) => ({
      ...r,
      amount: pesosToCentavos(r.amount),
    })),
    bills: (d.bills || []).map((b) => ({
      ...b,
      estimatedAmount:
        b.estimatedAmount === null || b.estimatedAmount === undefined
          ? undefined
          : pesosToCentavos(b.estimatedAmount),
    })),
    goals: (d.goals || []).map((g) => ({
      ...g,
      targetAmount: pesosToCentavos(g.targetAmount),
    })),
    loans: (d.loans || []).map((l) => ({
      ...l,
      amount: pesosToCentavos(l.amount),
    })),
  };
}
