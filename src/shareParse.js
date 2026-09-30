// Pulls a peso amount out of shared text, e.g. a copied GCash/Maya/bank
// message like "You paid PHP 350.00 to Jollibee". Only amounts with an
// explicit currency marker count — a bare number in a message is far too
// likely to be a reference number, a date, or a phone number.
//
// The bare single-letter "P" marker is the risky one — order/reference codes
// like "#P2093" also look like "P" + digits. Two things separate a real
// amount from an ID after a bare "P": a space before the digits ("P 99",
// which an ID never has), or the digits themselves being formatted like
// money — thousands commas or a decimal ("P1,234,567.89") — since an ID is
// almost always a single unformatted run of digits. PHP/₱ are unambiguous
// enough to skip both checks and allow the number right after them.
//
// No lookbehind assertions: Safari before 16.4 throws a SyntaxError on them
// while parsing the file, which would take the entire app down on older
// iPhones, not just this feature.
const MARKED_RE = /(?:^|[^A-Za-z])(?:PHP|Php|php|₱)\s?(\d[\d,]*(?:\.\d{1,2})?)/;
const BARE_P_SPACED_RE = /(?:^|[^A-Za-z0-9#])P\s(\d[\d,]*(?:\.\d{1,2})?)/;
const BARE_P_FORMATTED_RE =
  /(?:^|[^A-Za-z0-9#])P(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{1,2})/;

export function extractAmount(text) {
  if (!text) return null;
  const s = String(text);
  const match =
    MARKED_RE.exec(s) ||
    BARE_P_SPACED_RE.exec(s) ||
    BARE_P_FORMATTED_RE.exec(s);
  if (!match) return null;
  const n = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 && n < 1e9 ? n : null;
}
