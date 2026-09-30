import { jsPDF } from "jspdf";
import {
  state,
  DATA,
  monthTx,
  monthLabel,
  totals,
  budgetFor,
} from "./state.js";
import { catInfo } from "./categories.js";
import { currentCurrencyConfig } from "./currency.js";
import { getUserProfile } from "./auth.js";
import { showToast } from "./toast.js";

// A designed, shareable one-or-two-page statement for the period currently
// being viewed — separate from the CSV export (raw rows for a spreadsheet)
// and the JSON backup (for restoring into Kwenta itself). This one is for
// handing to someone else: a partner, a family member, anyone who wants a
// readable summary without opening the app.
//
// Amounts are written with the currency CODE ("PHP 1,234.00"), not the ₱
// symbol: jsPDF's built-in fonts only cover Western Latin, so the peso sign
// rendered as "±" in the previous version of this file. The code is also how
// Philippine bank statements write it, and it works for every currency the
// app lets you pick.

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_TOP = 282; // content stops above this line

// Palette — the app's own dark green, plus the two logo colors.
const INK = "#0e211b";
const INK_SOFT = "#6b7b74";
const LINE = "#e3e9e6";
const TRACK = "#eceff0";
const TEAL = "#33c7ab";
const GOLD = "#d4a72c";
const GREEN_TEXT = "#0a7a52";
const CORAL = "#d23a57";
const MUTED_ON_DARK = "#8fb5a6";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function rgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function mix(hex, withHex, amount) {
  const a = rgb(hex);
  const b = rgb(withHex);
  const m = a.map((v, i) => Math.round(v * (1 - amount) + b[i] * amount));
  return "#" + m.map((v) => v.toString(16).padStart(2, "0")).join("");
}
const fill = (doc, hex) => doc.setFillColor(...rgb(hex));
const ink = (doc, hex) => doc.setTextColor(...rgb(hex));

function money(n) {
  const cfg = currentCurrencyConfig();
  const digits = cfg.decimals ?? 2;
  const abs = Math.abs(Number(n) || 0).toLocaleString(cfg.locale || "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${Number(n) < 0 ? "-" : ""}${cfg.id.toUpperCase()} ${abs}`;
}

// Shortens text with "..." until it fits maxW at the current font.
function fit(doc, text, maxW) {
  const s = String(text ?? "");
  if (doc.getTextWidth(s) <= maxW) return s;
  let out = s;
  while (out.length > 1 && doc.getTextWidth(out + "...") > maxW)
    out = out.slice(0, -1);
  return out.trimEnd() + "...";
}

// Steps the font size down until the text fits — for big amounts in cards.
function fitFontSize(doc, text, maxW, start, min) {
  let size = start;
  doc.setFontSize(size);
  while (size > min && doc.getTextWidth(text) > maxW) {
    size -= 0.5;
    doc.setFontSize(size);
  }
  return size;
}

function shortDate(iso) {
  if (!iso) return "";
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

function ordinal(n) {
  if (n % 10 === 1 && n % 100 !== 11) return "st";
  if (n % 10 === 2 && n % 100 !== 12) return "nd";
  if (n % 10 === 3 && n % 100 !== 13) return "rd";
  return "th";
}

// The logo lives in public/ and is precached by the service worker, so this
// is a fast local read. If it ever fails, the header just falls back to a
// lettermark — the statement never fails to generate over a missing image.
async function loadLogo() {
  try {
    const res = await fetch("/icon-192.png");
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    return null;
  }
}

function drawHeader(doc, logo, periodLabel, preparedFor) {
  fill(doc, INK);
  doc.rect(0, 0, PAGE_W, 46, "F");
  // two-tone strip under the band, echoing the teal + gold of the logo
  fill(doc, TEAL);
  doc.rect(0, 46, PAGE_W * 0.62, 1.6, "F");
  fill(doc, GOLD);
  doc.rect(PAGE_W * 0.62, 46, PAGE_W * 0.38, 1.6, "F");

  if (logo) {
    doc.addImage(logo, "PNG", MARGIN, 12, 22, 22);
  } else {
    fill(doc, TEAL);
    doc.roundedRect(MARGIN, 12, 22, 22, 5, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    ink(doc, INK);
    doc.text("K", MARGIN + 11, 27, { align: "center" });
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(23);
  ink(doc, "#ffffff");
  doc.text("Kwenta", MARGIN + 27, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  ink(doc, MUTED_ON_DARK);
  doc.text("sulit sa bawat piso", MARGIN + 27, 30.5);

  const right = PAGE_W - MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  ink(doc, TEAL);
  doc.text("MONTHLY STATEMENT", right, 18, { align: "right" });
  doc.setFontSize(13);
  ink(doc, "#ffffff");
  doc.text(periodLabel, right, 26.5, { align: "right" });
  if (preparedFor) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    ink(doc, MUTED_ON_DARK);
    doc.text(`Prepared for ${fit(doc, preparedFor, 80)}`, right, 33.5, {
      align: "right",
    });
  }
}

function drawContinuationHeader(doc, periodLabel) {
  fill(doc, INK);
  doc.rect(0, 0, PAGE_W, 15, "F");
  fill(doc, TEAL);
  doc.rect(0, 15, PAGE_W * 0.62, 1, "F");
  fill(doc, GOLD);
  doc.rect(PAGE_W * 0.62, 15, PAGE_W * 0.38, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  ink(doc, "#ffffff");
  doc.text("Kwenta", MARGIN, 9.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  ink(doc, MUTED_ON_DARK);
  doc.text(`Statement · ${periodLabel}`, PAGE_W - MARGIN, 9.5, {
    align: "right",
  });
}

function drawSummaryCards(doc, y, t) {
  const gap = 5;
  const w = (CONTENT_W - gap * 2) / 3;
  const h = 27;
  const netNegative = t.balance < 0;
  const cards = [
    {
      label: "INCOME",
      value: money(t.totalIncome),
      bg: "#e7f8f0",
      labelColor: "#3c8d6e",
      valueColor: GREEN_TEXT,
    },
    {
      label: "EXPENSES",
      value: money(t.totalExpense),
      bg: "#fdecef",
      labelColor: "#b85468",
      valueColor: CORAL,
    },
    {
      label: "NET BALANCE",
      value: money(t.balance),
      bg: INK,
      labelColor: MUTED_ON_DARK,
      valueColor: netNegative ? "#ff8fa3" : "#ffffff",
    },
  ];
  cards.forEach((c, i) => {
    const x = MARGIN + i * (w + gap);
    fill(doc, c.bg);
    doc.roundedRect(x, y, w, h, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    ink(doc, c.labelColor);
    doc.text(c.label, x + 5, y + 8.5);
    doc.setFont("helvetica", "bold");
    fitFontSize(doc, c.value, w - 10, 14, 8);
    ink(doc, c.valueColor);
    doc.text(c.value, x + 5, y + 19);
  });
  return y + h;
}

export async function exportMonthlyStatementPDF() {
  try {
    const logo = await loadLogo();
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const periodLabel = monthLabel(state.monthKey);
    const { fullName } = getUserProfile();
    doc.setProperties({
      title: `Kwenta statement - ${periodLabel}`,
      author: "Kwenta",
    });

    drawHeader(doc, logo, periodLabel, fullName);

    let y = 58;
    const newPage = () => {
      doc.addPage();
      drawContinuationHeader(doc, periodLabel);
      y = 27;
    };
    const need = (h) => {
      if (y + h > FOOTER_TOP) newPage();
    };
    const sectionTitle = (title, rightText) => {
      need(16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      ink(doc, INK);
      doc.text(title, MARGIN, y);
      if (rightText) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        ink(doc, INK_SOFT);
        doc.text(rightText, PAGE_W - MARGIN, y, { align: "right" });
      }
      y += 7;
    };

    // ── Summary cards ──
    const t = totals();
    y = drawSummaryCards(doc, y, t) + 12;

    // ── Where the money went ──
    const exp = monthTx("expense");
    const byCat = {};
    exp.forEach((e) => {
      byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0);
    });
    const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const totalSpent = entries.reduce((s, [, v]) => s + v, 0);

    sectionTitle(
      "Where the money went",
      `${exp.length} ${exp.length === 1 ? "expense" : "expenses"}`,
    );

    if (entries.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      ink(doc, INK_SOFT);
      doc.text("No expenses were logged for this period.", MARGIN, y + 4);
      y += 12;
    } else {
      // proportional stacked bar, one flat segment per category
      let x = MARGIN;
      entries.forEach(([catId, amt]) => {
        const segW = (amt / totalSpent) * CONTENT_W;
        fill(doc, catInfo(catId).color);
        doc.rect(x, y, Math.max(segW - 0.6, 0.4), 6, "F");
        x += segW;
      });
      y += 13;

      entries.forEach(([catId, amt]) => {
        need(16);
        const c = catInfo(catId);
        const budget = budgetFor(catId); // this period's limit (0 = none set)
        const over = budget > 0 && amt > budget;

        fill(doc, c.color);
        doc.circle(MARGIN + 2.2, y - 1.2, 1.7, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        ink(doc, INK);
        doc.text(fit(doc, c.label, 95), MARGIN + 7, y);
        doc.text(money(amt), PAGE_W - MARGIN, y, { align: "right" });

        let barFrac;
        let sub;
        if (budget > 0) {
          const ratio = amt / budget;
          barFrac = Math.min(1, ratio);
          sub = `${Math.round(ratio * 100)}% of ${money(budget)} budget${over ? " - over budget" : ""}`;
        } else {
          barFrac = totalSpent ? amt / totalSpent : 0;
          sub = `${Math.round(barFrac * 100)}% of spending`;
        }
        doc.setFont("helvetica", over ? "bold" : "normal");
        doc.setFontSize(8);
        ink(doc, over ? CORAL : INK_SOFT);
        doc.text(sub, MARGIN + 7, y + 4.6);

        const barX = MARGIN + 7;
        const barW = CONTENT_W - 7;
        fill(doc, TRACK);
        doc.roundedRect(barX, y + 6.6, barW, 1.8, 0.9, 0.9, "F");
        if (barFrac > 0) {
          fill(doc, over ? CORAL : c.color);
          doc.roundedRect(
            barX,
            y + 6.6,
            Math.max(barW * barFrac, 1.8),
            1.8,
            0.9,
            0.9,
            "F",
          );
        }
        y += 15;
      });
    }
    y += 4;

    // ── Biggest expenses ──
    const biggest = exp
      .slice()
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5);
    if (biggest.length > 0) {
      need(16 + biggest.length * 11); // keep the title and its rows together on one page
      sectionTitle("Biggest expenses");
      biggest.forEach((tx, i) => {
        need(12);
        const c = catInfo(tx.category);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        ink(doc, INK_SOFT);
        doc.text(shortDate(tx.date), MARGIN, y);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        ink(doc, INK);
        doc.text(fit(doc, tx.desc || c.label, 100), MARGIN + 20, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        ink(doc, INK_SOFT);
        doc.text(c.label, MARGIN + 20, y + 4.2);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        ink(doc, CORAL);
        doc.text(money(tx.amount), PAGE_W - MARGIN, y, { align: "right" });
        if (i < biggest.length - 1) {
          fill(doc, LINE);
          doc.rect(MARGIN, y + 7, CONTENT_W, 0.25, "F");
        }
        y += 11;
      });
      y += 5;
    }

    // ── Bills on file ──
    if (DATA.bills.length > 0) {
      need(16 + Math.min(DATA.bills.length, 5) * 8.5); // same — never strand the title alone
      sectionTitle("Bills on file", "due each month");
      DATA.bills.forEach((bill, i) => {
        need(10);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        ink(doc, INK);
        doc.text(fit(doc, bill.name, 90), MARGIN, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        ink(doc, INK_SOFT);
        doc.text(
          `Due on the ${bill.dueDay}${ordinal(bill.dueDay)}`,
          MARGIN + 100,
          y,
        );
        if (bill.estimatedAmount) {
          doc.setFont("helvetica", "bold");
          ink(doc, INK);
          doc.text(`~${money(bill.estimatedAmount)}`, PAGE_W - MARGIN, y, {
            align: "right",
          });
        }
        if (i < DATA.bills.length - 1) {
          fill(doc, LINE);
          doc.rect(MARGIN, y + 3.2, CONTENT_W, 0.25, "F");
        }
        y += 8.5;
      });
    }

    // ── Footer on every page (drawn last, once the page count is known) ──
    const pages = doc.getNumberOfPages();
    const generated = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      fill(doc, LINE);
      doc.rect(MARGIN, PAGE_H - 13, CONTENT_W, 0.25, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      ink(doc, INK_SOFT);
      doc.text(`Generated by Kwenta · ${generated}`, MARGIN, PAGE_H - 8);
      doc.text(`Page ${p} of ${pages}`, PAGE_W - MARGIN, PAGE_H - 8, {
        align: "right",
      });
      fill(doc, TEAL);
      doc.rect(0, PAGE_H - 3, PAGE_W * 0.62, 3, "F");
      fill(doc, GOLD);
      doc.rect(PAGE_W * 0.62, PAGE_H - 3, PAGE_W * 0.38, 3, "F");
    }

    await deliver(doc, `kwenta-statement-${state.monthKey}.pdf`, periodLabel);
  } catch (e) {
    console.error("Statement export failed", e);
    showToast("Couldn't create the statement. Please try again.");
  }
}

// On a phone, hand the PDF straight to the native share sheet (Messages,
// WhatsApp, Messenger, AirDrop, Save to Files…) — far better than a silent
// download that lands somewhere you have to go find. Desktop, or any browser
// that can't share files, gets a normal download instead.
async function deliver(doc, filename, periodLabel) {
  const isTouch =
    typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  if (isTouch && typeof File === "function" && navigator.canShare) {
    const file = new File([doc.output("blob")], filename, {
      type: "application/pdf",
    });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Kwenta statement - ${periodLabel}`,
        });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return; // closed the sheet on purpose — don't ALSO download
        // anything else (e.g. the browser refused the share): fall back to a download
      }
    }
  }
  doc.save(filename);
}
