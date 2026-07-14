import { jsPDF } from "jspdf";
import type { DailyReportData, DenominationLine } from "./cashier";

/** Paper form denomination rows (20 bill vs 20 coin cannot both be known from stored data). */
export const CASH_COUNT_DENOMS: {
  key: string;
  label: string;
  value: number;
  /** When true, this row is never auto-filled (system stores a single ₱20). */
  skipFill?: boolean;
}[] = [
  { key: "1000", label: "1000-peso bill", value: 1000 },
  { key: "500", label: "500-peso bill", value: 500 },
  { key: "200", label: "200-peso bill", value: 200 },
  { key: "100", label: "100-peso bill", value: 100 },
  { key: "50", label: "50-peso bill", value: 50 },
  { key: "20b", label: "20-peso bill", value: 20 },
  { key: "20c", label: "20-peso coin", value: 20, skipFill: true },
  { key: "10", label: "10-peso coin", value: 10 },
  { key: "5", label: "5-peso coin", value: 5 },
  { key: "1", label: "1-peso coin", value: 1 },
];

export type CashCountCategory =
  | "basket"
  | "kalag"
  | "special_intention"
  | "love_offering"
  | "others";

const CATEGORIES: { id: CashCountCategory; label: string }[] = [
  { id: "basket", label: "BASKET" },
  { id: "kalag", label: "KALAG" },
  { id: "special_intention", label: "SPECIAL\nINTENTION" },
  { id: "love_offering", label: "LOVE\nOFFERING" },
  { id: "others", label: "OTHERS" },
];

type CountMap = Record<number, number>;

const emptyCountMap = (): CountMap => ({
  1000: 0,
  500: 0,
  200: 0,
  100: 0,
  50: 0,
  20: 0,
  10: 0,
  5: 0,
  1: 0,
});

const addBreakdown = (target: CountMap, lines?: DenominationLine[] | null) => {
  if (!lines?.length) return;
  for (const line of lines) {
    const denom = Number(line.denomination) || 0;
    const count = Math.max(0, Math.floor(Number(line.count) || 0));
    if (denom in target && count > 0) {
      target[denom] += count;
    }
  }
};

type LumpMap = Record<CashCountCategory, number>;

const isFuneralLabel = (value?: string | null) =>
  /funeral/i.test(String(value || ""));

const breakdownTotal = (lines?: DenominationLine[] | null) => {
  if (!lines?.length) return 0;
  return lines.reduce((sum, line) => {
    const total = Number(line.total);
    if (!Number.isNaN(total) && total > 0) return sum + total;
    return sum + (Number(line.denomination) || 0) * (Number(line.count) || 0);
  }, 0);
};

/** Amount with no denomination lines (or shortfall) goes into column TOTAL as a lump. */
const addAmountWithOptionalBreakdown = (
  map: CountMap,
  lumpKey: CashCountCategory,
  lumps: LumpMap,
  amount: number,
  lines?: DenominationLine[] | null
) => {
  const amt = Number(amount) || 0;
  if (amt <= 0 && !lines?.length) return;

  if (lines?.length) {
    addBreakdown(map, lines);
    const covered = breakdownTotal(lines);
    const shortfall = Math.max(0, amt - covered);
    if (shortfall > 0.009) lumps[lumpKey] += shortfall;
  } else if (amt > 0) {
    lumps[lumpKey] += amt;
  }
};

export type CashCountGrid = Record<CashCountCategory, CountMap> & {
  lumps: LumpMap;
};

/** Build denomination grids from daily report. */
export const buildCashCountGrid = (report: DailyReportData): CashCountGrid => {
  const lumps: LumpMap = {
    basket: 0,
    kalag: 0,
    special_intention: 0,
    love_offering: 0,
    others: 0,
  };

  const grid: CashCountGrid = {
    basket: emptyCountMap(),
    kalag: emptyCountMap(),
    special_intention: emptyCountMap(),
    love_offering: emptyCountMap(),
    others: emptyCountMap(),
    lumps,
  };

  // Mass collections: funeral → KALAG, otherwise → BASKET (offering)
  for (const m of report.mass_collections || []) {
    const bucket: CashCountCategory = isFuneralLabel(m.mass_type) ? "kalag" : "basket";
    addAmountWithOptionalBreakdown(
      grid[bucket],
      bucket,
      lumps,
      m.amount,
      m.denomination_breakdown
    );
  }

  // Special intentions (mobile often has amount with no denomination breakdown)
  for (const row of report.special_intentions || []) {
    addAmountWithOptionalBreakdown(
      grid.special_intention,
      "special_intention",
      lumps,
      row.amount,
      row.denomination_breakdown
    );
  }

  // Donations → LOVE OFFERING
  for (const d of report.donations || []) {
    addAmountWithOptionalBreakdown(
      grid.love_offering,
      "love_offering",
      lumps,
      d.amount,
      d.denomination_breakdown
    );
  }

  // Service fee payments: Funeral Mass → KALAG; all other service fees → OTHERS
  for (const p of report.service_payments || []) {
    const amt = Number(p.amount) || 0;
    if (amt <= 0) continue;
    if (isFuneralLabel(p.service_type)) {
      lumps.kalag += amt;
    } else {
      lumps.others += amt;
    }
  }

  console.log("Cash count grid built:", {
    date: report.date,
    basket: grid.basket,
    kalag: grid.kalag,
    special_intention: grid.special_intention,
    love_offering: grid.love_offering,
    lumps,
  });

  return grid;
};

const peso = (n: number) =>
  Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const countForRow = (
  map: CountMap,
  row: (typeof CASH_COUNT_DENOMS)[number]
): number => {
  if (row.skipFill) return 0;
  return map[row.value] || 0;
};

const hasDenominationCounts = (map: CountMap) =>
  Object.values(map).some((c) => (Number(c) || 0) > 0);

export const downloadCashCountPdf = (report: DailyReportData) => {
  const grid = buildCashCountGrid(report);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 10;
  const marginY = 8;
  const contentW = pageW - marginX * 2;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("SAN GUILLERMO DE MALEVAL PARISH", pageW / 2, marginY + 4, {
    align: "center",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("IPONAN, CAGAYAN DE ORO CITY", pageW / 2, marginY + 9, {
    align: "center",
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("CASH COUNT FORM", pageW / 2, marginY + 16, { align: "center" });

  // Meta row
  const metaY = marginY + 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Date: ${report.date}`, marginX, metaY);
  doc.text("Time: ____________________", marginX + 55, metaY);
  doc.text("(5pm / 5am / 7am / 9am / 11am / 5pm)", marginX + 55, metaY + 4);
  doc.text("Holy Mass No./Name: ____________________", marginX + 140, metaY);
  doc.text(
    "1st / 2nd / 3rd / 4th / 5th / 6th / Baikingon / Hinaplanon / Bulao",
    marginX + 140,
    metaY + 4
  );

  // Table geometry
  const tableTop = metaY + 10;
  const denomColW = 32;
  const totalColW = 28;
  const catColW = (contentW - denomColW - totalColW) / CATEGORIES.length;
  const headerH = 12;
  const rowH = 9.2;
  const totalRowH = 10;

  const colX = (index: number) => {
    if (index === 0) return marginX;
    if (index <= CATEGORIES.length) return marginX + denomColW + (index - 1) * catColW;
    return marginX + denomColW + CATEGORIES.length * catColW;
  };

  const drawCell = (
    x: number,
    y: number,
    w: number,
    h: number,
    opts?: { fill?: number[] }
  ) => {
    if (opts?.fill) {
      doc.setFillColor(opts.fill[0], opts.fill[1], opts.fill[2]);
      doc.rect(x, y, w, h, "FD");
    } else {
      doc.rect(x, y, w, h);
    }
  };

  // Header row
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  drawCell(colX(0), tableTop, denomColW, headerH, { fill: [240, 240, 240] });
  doc.text("Denomination", colX(0) + denomColW / 2, tableTop + headerH / 2 + 1, {
    align: "center",
  });

  CATEGORIES.forEach((cat, i) => {
    const x = colX(i + 1);
    drawCell(x, tableTop, catColW, headerH, { fill: [240, 240, 240] });
    const lines = cat.label.split("\n");
    const startY = lines.length > 1 ? tableTop + 4.2 : tableTop + headerH / 2 + 1;
    lines.forEach((line, li) => {
      doc.text(line, x + catColW / 2, startY + li * 3.4, { align: "center" });
    });
  });

  drawCell(colX(CATEGORIES.length + 1), tableTop, totalColW, headerH, {
    fill: [240, 240, 240],
  });
  doc.text("TOTAL", colX(CATEGORIES.length + 1) + totalColW / 2, tableTop + headerH / 2 + 1, {
    align: "center",
  });

  const categoryTotals: Record<CashCountCategory, number> = {
    basket: grid.lumps.basket,
    kalag: grid.lumps.kalag,
    special_intention: grid.lumps.special_intention,
    love_offering: grid.lumps.love_offering,
    others: grid.lumps.others,
  };
  let grandTotal =
    grid.lumps.basket +
    grid.lumps.kalag +
    grid.lumps.special_intention +
    grid.lumps.love_offering +
    grid.lumps.others;

  // Data rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);

  CASH_COUNT_DENOMS.forEach((row, rowIndex) => {
    const y = tableTop + headerH + rowIndex * rowH;
    drawCell(colX(0), y, denomColW, rowH);
    doc.setFont("helvetica", "normal");
    doc.text(row.label, colX(0) + 1.5, y + rowH / 2 + 1);

    let rowTotal = 0;
    CATEGORIES.forEach((cat, i) => {
      const x = colX(i + 1);
      drawCell(x, y, catColW, rowH);
      doc.setDrawColor(200);
      doc.line(x + catColW / 2, y, x + catColW / 2, y + rowH);
      doc.setDrawColor(0);

      const count = countForRow(grid[cat.id], row);
      const amount = count * row.value;
      categoryTotals[cat.id] += amount;
      rowTotal += amount;

      if (count > 0) {
        doc.text(String(count), x + catColW / 4, y + rowH / 2 + 1, { align: "center" });
        doc.text(peso(amount), x + (catColW * 3) / 4, y + rowH / 2 + 1, {
          align: "center",
        });
      }
    });

    grandTotal += rowTotal;
    const tx = colX(CATEGORIES.length + 1);
    drawCell(tx, y, totalColW, rowH);
    if (rowTotal > 0) {
      doc.setFont("helvetica", "bold");
      doc.text(peso(rowTotal), tx + totalColW / 2, y + rowH / 2 + 1, { align: "center" });
      doc.setFont("helvetica", "normal");
    }
  });

  // Categories with a total but no denomination breakdown — label the empty column body
  const bodyTop = tableTop + headerH;
  const bodyH = CASH_COUNT_DENOMS.length * rowH;
  CATEGORIES.forEach((cat, i) => {
    const lump = grid.lumps[cat.id] || 0;
    if (lump <= 0 || hasDenominationCounts(grid[cat.id])) return;

    const x = colX(i + 1);
    const cx = x + catColW / 2;
    const cy = bodyTop + bodyH / 2;

    // Soft fill so empty columns are obvious
    doc.setFillColor(255, 250, 235);
    doc.rect(x + 0.4, bodyTop + 0.4, catColW - 0.8, bodyH - 0.8, "F");

    doc.setTextColor(120, 80, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("No denomination", cx, cy - 3, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text("(amount in TOTAL only)", cx, cy + 1.5, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`P${peso(lump)}`, cx, cy + 7, { align: "center" });
    doc.setTextColor(0, 0, 0);
    console.log(`Cash count PDF: ${cat.id} has lump with no denomination:`, lump);
  });

  // TOTAL row
  const totalY = tableTop + headerH + CASH_COUNT_DENOMS.length * rowH;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  drawCell(colX(0), totalY, denomColW, totalRowH, { fill: [245, 245, 245] });
  doc.text("TOTAL", colX(0) + denomColW / 2, totalY + totalRowH / 2 + 1, {
    align: "center",
  });

  CATEGORIES.forEach((cat, i) => {
    const x = colX(i + 1);
    drawCell(x, totalY, catColW, totalRowH, { fill: [245, 245, 245] });
    const val = categoryTotals[cat.id];
    if (val > 0) {
      doc.text(peso(val), x + catColW / 2, totalY + totalRowH / 2 + 1, {
        align: "center",
      });
    }
  });

  const tx = colX(CATEGORIES.length + 1);
  drawCell(tx, totalY, totalColW, totalRowH, { fill: [230, 245, 230] });
  doc.text(peso(grandTotal), tx + totalColW / 2, totalY + totalRowH / 2 + 1, {
    align: "center",
  });

  // Remarks
  const remarksTop = totalY + totalRowH + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Remarks:", marginX, remarksTop);

  const noDenomLabels = CATEGORIES.filter(
    (cat) => (grid.lumps[cat.id] || 0) > 0 && !hasDenominationCounts(grid[cat.id])
  ).map((cat) => cat.label.replace("\n", " "));

  const remarkLines = [
    `System income for ${report.date}: P${peso(report.income_for_date)} (form total: P${peso(grandTotal)})`,
    `Basket (offering): P${peso(categoryTotals.basket)} | Kalag (funeral mass / funeral service fees): P${peso(categoryTotals.kalag)}`,
    `Special Intention: P${peso(categoryTotals.special_intention)} | Love Offering (donations): P${peso(categoryTotals.love_offering)} | Others (other service fees): P${peso(categoryTotals.others)}`,
    ...(noDenomLabels.length
      ? [`No denomination recorded for: ${noDenomLabels.join(", ")} (see column label + TOTAL).`]
      : []),
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  remarkLines.forEach((line, i) => {
    const y = remarksTop + 5 + i * 5;
    doc.text(line, marginX + 2, y);
    doc.setDrawColor(160);
    doc.line(marginX, y + 1.5, marginX + contentW, y + 1.5);
    doc.setDrawColor(0);
  });

  // Signatures
  const sigY = Math.min(remarksTop + 28, pageH - 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Counted and Checked by:", pageW / 2, sigY, { align: "center" });

  const sigLineY = sigY + 12;
  const sigW = 55;
  const gap = (contentW - sigW * 3) / 2;
  [0, 1, 2].forEach((i) => {
    const x = marginX + i * (sigW + gap);
    doc.setDrawColor(0);
    doc.line(x, sigLineY, x + sigW, sigLineY);
  });

  const filename = `Cash_Count_Form_${report.date}.pdf`;
  console.log("Downloading cash count PDF:", filename, { grandTotal, categoryTotals });
  doc.save(filename);
};
