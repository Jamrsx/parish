import { jsPDF } from "jspdf";
import type { DailyReportData, DenominationLine, MassCollectionRow } from "./cashier";

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
  | "donation"
  | "others";

export type CashCountPdfMode = "full-day" | "per-mass";

export interface CashCountPdfOptions {
  mode?: CashCountPdfMode;
  /** Required when mode is per-mass */
  massCollectionId?: number;
  /** Override header Time (otherwise derived from mass_time) */
  timeLabel?: string | null;
  /** Override header Holy Mass No./Name (otherwise mass_type) */
  holyMassLabel?: string | null;
}

const CATEGORIES: { id: CashCountCategory; label: string }[] = [
  { id: "basket", label: "BASKET" },
  { id: "kalag", label: "KALAG" },
  { id: "special_intention", label: "SPECIAL\nINTENTION" },
  { id: "love_offering", label: "LOVE\nOFFERING" },
  { id: "donation", label: "DONATION" },
  { id: "others", label: "OTHERS" },
];

type CountMap = Record<number, number>;
type LumpMap = Record<CashCountCategory, number>;

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

export const isFuneralLabel = (value?: string | null) =>
  /funeral/i.test(String(value || ""));

const breakdownTotal = (lines?: DenominationLine[] | null) => {
  if (!lines?.length) return 0;
  return lines.reduce((sum, line) => {
    const total = Number(line.total);
    if (!Number.isNaN(total) && total > 0) return sum + total;
    return sum + (Number(line.denomination) || 0) * (Number(line.count) || 0);
  }, 0);
};

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

/** Map stored H:i to paper-style labels used on the Cash Count Form. */
export const formatMassTimeLabel = (massTime?: string | null): string => {
  if (!massTime) return "";
  const raw = String(massTime).trim().slice(0, 5);
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return raw;

  let hour = Number(match[1]);
  const minute = match[2];
  if (Number.isNaN(hour)) return raw;

  // Canonical parish options on the paper form
  const map: Record<string, string> = {
    "05:00": "5am",
    "07:00": "7am",
    "09:00": "9am",
    "11:00": "11am",
    "17:00": "5pm",
  };
  const key = `${String(hour).padStart(2, "0")}:${minute}`;
  if (map[key]) return map[key];

  const period = hour >= 12 ? "pm" : "am";
  const h12 = hour % 12 || 12;
  return minute === "00" ? `${h12}${period}` : `${h12}:${minute}${period}`;
};

export const massCollectionLabel = (m: MassCollectionRow) => {
  const time = formatMassTimeLabel(m.mass_time);
  return time ? `${m.mass_type} · ${time}` : m.mass_type;
};

/** Build denomination grids from daily report (full day or single mass). */
export const buildCashCountGrid = (
  report: DailyReportData,
  options: CashCountPdfOptions = {}
): CashCountGrid => {
  const mode = options.mode || "full-day";
  const lumps: LumpMap = {
    basket: 0,
    kalag: 0,
    special_intention: 0,
    love_offering: 0,
    donation: 0,
    others: 0,
  };

  const grid: CashCountGrid = {
    basket: emptyCountMap(),
    kalag: emptyCountMap(),
    special_intention: emptyCountMap(),
    love_offering: emptyCountMap(),
    donation: emptyCountMap(),
    others: emptyCountMap(),
    lumps,
  };

  if (mode === "per-mass") {
    const mass = (report.mass_collections || []).find(
      (m) => m.collection_id === options.massCollectionId
    );
    if (!mass) {
      console.warn("Per-mass cash count: mass collection not found", options.massCollectionId);
      return grid;
    }
    const bucket: CashCountCategory = isFuneralLabel(mass.mass_type) ? "kalag" : "basket";
    addAmountWithOptionalBreakdown(
      grid[bucket],
      bucket,
      lumps,
      mass.amount,
      mass.denomination_breakdown
    );
    console.log("Cash count grid (per-mass) built:", {
      date: report.date,
      collection_id: mass.collection_id,
      bucket,
      lumps,
    });
    return grid;
  }

  // Full day: mass collections
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

  for (const row of report.special_intentions || []) {
    addAmountWithOptionalBreakdown(
      grid.special_intention,
      "special_intention",
      lumps,
      row.amount,
      row.denomination_breakdown
    );
  }

  for (const d of report.donations || []) {
    const bucket: CashCountCategory =
      d.contribution_type === "donation" ? "donation" : "love_offering";
    addAmountWithOptionalBreakdown(
      grid[bucket],
      bucket,
      lumps,
      d.amount,
      d.denomination_breakdown
    );
  }

  for (const p of report.service_payments || []) {
    const amt = Number(p.amount) || 0;
    if (amt <= 0) continue;
    if (isFuneralLabel(p.service_type)) {
      lumps.kalag += amt;
    } else {
      lumps.others += amt;
    }
  }

  console.log("Cash count grid (full-day) built:", {
    date: report.date,
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

const fillMetaLine = (label: string, value: string, blankPad = 28) => {
  const padded = value
    ? value
    : "_".repeat(blankPad);
  return `${label}: ${padded}`;
};

export const downloadCashCountPdf = (
  report: DailyReportData,
  options: CashCountPdfOptions = {}
) => {
  const mode = options.mode || "full-day";
  const selectedMass =
    mode === "per-mass"
      ? (report.mass_collections || []).find((m) => m.collection_id === options.massCollectionId)
      : undefined;

  if (mode === "per-mass" && !selectedMass) {
    throw new Error("Mass collection not found for per-mass Cash Count PDF.");
  }

  const timeLabel =
    options.timeLabel !== undefined && options.timeLabel !== null
      ? options.timeLabel
      : selectedMass
        ? formatMassTimeLabel(selectedMass.mass_time)
        : "";
  const holyMassLabel =
    options.holyMassLabel !== undefined && options.holyMassLabel !== null
      ? options.holyMassLabel
      : selectedMass
        ? selectedMass.mass_type || ""
        : "";

  const grid = buildCashCountGrid(report, options);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 10;
  const marginY = 8;
  const contentW = pageW - marginX * 2;

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
  if (mode === "per-mass") {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text("(Per Holy Mass)", pageW / 2, marginY + 20, { align: "center" });
    doc.setTextColor(0);
  }

  const metaY = marginY + (mode === "per-mass" ? 26 : 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Date: ${report.date}`, marginX, metaY);
  doc.text(fillMetaLine("Time", timeLabel, 20), marginX + 55, metaY);
  doc.text("(5pm / 5am / 7am / 9am / 11am / 5pm)", marginX + 55, metaY + 4);
  doc.text(fillMetaLine("Holy Mass No./Name", holyMassLabel, 22), marginX + 140, metaY);
  doc.text(
    "1st / 2nd / 3rd / 4th / 5th / 6th / Baikingon / Hinaplanon / Bulao",
    marginX + 140,
    metaY + 4
  );

  const tableTop = metaY + 10;
  const denomColW = 28;
  const totalColW = 24;
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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
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
    donation: grid.lumps.donation,
    others: grid.lumps.others,
  };
  let grandTotal =
    grid.lumps.basket +
    grid.lumps.kalag +
    grid.lumps.special_intention +
    grid.lumps.love_offering +
    grid.lumps.donation +
    grid.lumps.others;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);

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
    const totalX = colX(CATEGORIES.length + 1);
    drawCell(totalX, y, totalColW, rowH);
    if (rowTotal > 0) {
      doc.setFont("helvetica", "bold");
      doc.text(peso(rowTotal), totalX + totalColW / 2, y + rowH / 2 + 1, { align: "center" });
      doc.setFont("helvetica", "normal");
    }
  });

  const bodyTop = tableTop + headerH;
  const bodyH = CASH_COUNT_DENOMS.length * rowH;
  CATEGORIES.forEach((cat, i) => {
    const lump = grid.lumps[cat.id] || 0;
    if (lump <= 0 || hasDenominationCounts(grid[cat.id])) return;

    const x = colX(i + 1);
    const cx = x + catColW / 2;
    const cy = bodyTop + bodyH / 2;

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
  });

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

  const totalX = colX(CATEGORIES.length + 1);
  drawCell(totalX, totalY, totalColW, totalRowH, { fill: [230, 245, 230] });
  doc.text(peso(grandTotal), totalX + totalColW / 2, totalY + totalRowH / 2 + 1, {
    align: "center",
  });

  const remarksTop = totalY + totalRowH + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Remarks:", marginX, remarksTop);

  const noDenomLabels = CATEGORIES.filter(
    (cat) => (grid.lumps[cat.id] || 0) > 0 && !hasDenominationCounts(grid[cat.id])
  ).map((cat) => cat.label.replace("\n", " "));

  const remarkLines =
    mode === "per-mass"
      ? [
          `Per-mass form for ${holyMassLabel || "Holy Mass"}${timeLabel ? ` at ${timeLabel}` : ""} on ${report.date}.`,
          `Mass collection only: P${peso(grandTotal)} (Basket P${peso(categoryTotals.basket)} | Kalag P${peso(categoryTotals.kalag)}).`,
          `Special Intention, Love Offering, Donation, and other service fees are NOT included — use Full Day PDF for those.`,
          `Day income (all sources): P${peso(report.income_for_date)}.`,
          ...(noDenomLabels.length
            ? [`No denomination recorded for: ${noDenomLabels.join(", ")}.`]
            : []),
        ]
      : [
          `System income for ${report.date}: P${peso(report.income_for_date)} (form total: P${peso(grandTotal)})`,
          `Basket (offering): P${peso(categoryTotals.basket)} | Kalag (funeral mass / funeral service fees): P${peso(categoryTotals.kalag)}`,
          `Special Intention: P${peso(categoryTotals.special_intention)} | Love Offering: P${peso(categoryTotals.love_offering)} | Donation: P${peso(categoryTotals.donation)} | Others: P${peso(categoryTotals.others)}`,
          ...(noDenomLabels.length
            ? [`No denomination recorded for: ${noDenomLabels.join(", ")} (see column label + TOTAL).`]
            : []),
        ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  remarkLines.forEach((line, i) => {
    const y = remarksTop + 5 + i * 4.5;
    doc.text(line, marginX + 2, y);
    doc.setDrawColor(160);
    doc.line(marginX, y + 1.2, marginX + contentW, y + 1.2);
    doc.setDrawColor(0);
  });

  const sigY = Math.min(remarksTop + 8 + remarkLines.length * 4.5 + 6, pageH - 18);
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

  // Page 2 (Full Day only): Love Offering donor list — who gave each donation
  if (mode === "full-day") {
    appendLoveOfferingDonorPage(doc, report, {
      pageW,
      pageH,
      marginX,
      marginY,
      contentW,
    });
  }

  const safeMass = (holyMassLabel || "mass").replace(/[^\w\-]+/g, "_").slice(0, 40);
  const safeTime = (timeLabel || "na").replace(/[^\w\-]+/g, "_");
  const filename =
    mode === "per-mass"
      ? `Cash_Count_Form_${report.date}_${safeMass}_${safeTime}.pdf`
      : `Cash_Count_Form_${report.date}_FullDay.pdf`;

  console.log("Downloading cash count PDF:", filename, {
    mode,
    grandTotal,
    categoryTotals,
    timeLabel,
    holyMassLabel,
    loveOfferingDonors: (report.donations || []).length,
  });
  doc.save(filename);
};

const loveOfferingDonorLabel = (donorName?: string | null): string => {
  const name = (donorName || "").trim();
  if (!name) return "Anonymous";
  return name;
};

const contributionTypeLabel = (type?: string | null): string =>
  type === "donation" ? "Donation" : "Love Offering";

const appendLoveOfferingDonorPage = (
  doc: jsPDF,
  report: DailyReportData,
  layout: {
    pageW: number;
    pageH: number;
    marginX: number;
    marginY: number;
    contentW: number;
  }
) => {
  const donations = [...(report.donations || [])].sort((a, b) => {
    const typeA = contributionTypeLabel(a.contribution_type);
    const typeB = contributionTypeLabel(b.contribution_type);
    if (typeA !== typeB) return typeA.localeCompare(typeB);
    const nameA = loveOfferingDonorLabel(a.donor_name).toLowerCase();
    const nameB = loveOfferingDonorLabel(b.donor_name).toLowerCase();
    if (nameA !== nameB) return nameA.localeCompare(nameB);
    return Number(b.amount || 0) - Number(a.amount || 0);
  });

  const { pageW, pageH, marginX, marginY, contentW } = layout;
  const loveTotal = donations
    .filter((d) => d.contribution_type !== "donation")
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const donationTotal = donations
    .filter((d) => d.contribution_type === "donation")
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const combinedTotal = loveTotal + donationTotal;

  console.log("Cash count PDF page 2 — donors by type:", {
    date: report.date,
    count: donations.length,
    loveTotal,
    donationTotal,
  });

  doc.addPage("a4", "landscape");

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
  doc.text("LOVE OFFERING & DONATION — DONOR LIST", pageW / 2, marginY + 16, {
    align: "center",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text(
    `Supporting page for Cash Count Form · Date: ${report.date}`,
    pageW / 2,
    marginY + 21,
    { align: "center" }
  );
  doc.setTextColor(0);

  const tableTop = marginY + 28;
  const colWidths = [10, 36, 58, 30, 26, 26, contentW - 10 - 36 - 58 - 30 - 26 - 26];
  const headers = ["#", "Type", "Donor", "Amount", "Date", "Status", "Notes"];
  const headerH = 9;
  const rowH = 8;

  const drawCell = (
    x: number,
    y: number,
    w: number,
    h: number,
    opts?: { fill?: [number, number, number] }
  ) => {
    if (opts?.fill) {
      doc.setFillColor(...opts.fill);
      doc.rect(x, y, w, h, "FD");
    } else {
      doc.rect(x, y, w, h);
    }
  };

  let x = marginX;
  headers.forEach((header, i) => {
    drawCell(x, tableTop, colWidths[i], headerH, { fill: [230, 245, 230] });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(header, x + colWidths[i] / 2, tableTop + headerH / 2 + 1, {
      align: "center",
    });
    x += colWidths[i];
  });

  if (donations.length === 0) {
    const emptyY = tableTop + headerH;
    drawCell(marginX, emptyY, contentW, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(
      "No Love Offering or Donation recorded for this date.",
      pageW / 2,
      emptyY + 11,
      { align: "center" }
    );
    doc.setTextColor(0);
    return;
  }

  let y = tableTop + headerH;
  const maxY = pageH - 28;

  donations.forEach((donation, index) => {
    if (y + rowH > maxY) {
      doc.addPage("a4", "landscape");
      y = marginY + 12;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(
        `LOVE OFFERING & DONATION — DONOR LIST (continued) · ${report.date}`,
        pageW / 2,
        y,
        { align: "center" }
      );
      y += 8;
      let hx = marginX;
      headers.forEach((header, i) => {
        drawCell(hx, y, colWidths[i], headerH, { fill: [230, 245, 230] });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(header, hx + colWidths[i] / 2, y + headerH / 2 + 1, {
          align: "center",
        });
        hx += colWidths[i];
      });
      y += headerH;
    }

    const donor = loveOfferingDonorLabel(donation.donor_name);
    const isAnonymous = donor === "Anonymous";
    const type = contributionTypeLabel(donation.contribution_type);
    const notes = (donation.notes || "").trim() || "—";
    const status = (donation.status || "received").toUpperCase();
    const cells = [
      String(index + 1),
      type,
      donor,
      `P${peso(donation.amount)}`,
      donation.donation_date || report.date,
      status,
      notes,
    ];

    let cx = marginX;
    cells.forEach((text, i) => {
      drawCell(cx, y, colWidths[i], rowH, {
        fill: index % 2 === 0 ? [252, 252, 252] : undefined,
      });
      doc.setFont("helvetica", i === 2 && isAnonymous ? "italic" : "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(isAnonymous && i === 2 ? 110 : 0);
      const maxTextW = colWidths[i] - 3;
      const clipped =
        doc.getTextWidth(text) > maxTextW
          ? `${text.slice(0, Math.max(8, Math.floor(text.length * (maxTextW / doc.getTextWidth(text)))) - 1)}…`
          : text;
      const align = i === 0 || i === 1 || i === 3 || i === 4 || i === 5 ? "center" : "left";
      const tx = align === "center" ? cx + colWidths[i] / 2 : cx + 2;
      doc.text(clipped, tx, y + rowH / 2 + 1, { align });
      doc.setTextColor(0);
      cx += colWidths[i];
    });

    y += rowH;
  });

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const summaryY = Math.min(y + 4, pageH - 16);
  doc.text(
    `Love Offering: P${peso(loveTotal)} · Donation: P${peso(donationTotal)} · Combined: P${peso(combinedTotal)} · ${donations.length} record(s)`,
    marginX,
    summaryY
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(90);
  doc.text(
    "Type comes from the secretary record. Blank donor names appear as Anonymous.",
    marginX,
    Math.min(summaryY + 5, pageH - 8)
  );
  doc.setTextColor(0);
};
