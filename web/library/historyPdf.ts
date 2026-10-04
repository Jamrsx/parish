import type { LedgerEntry, LedgerSummary } from "./history";

const peso = (n: number) =>
  `PHP ${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MARGIN_X = 14;
const ROW_H = 6.5;

interface Column {
  header: string;
  width: number;
  align?: "left" | "right";
}

/** Church transactions ledger for a period, landscape A4. */
export const downloadTransactionsPdf = async (
  summary: LedgerSummary,
  items: LedgerEntry[],
  filterNote: string | null
): Promise<void> => {
  console.log("[HistoryPdf] Loading PDF library...", { rows: items.length });
  const { jsPDF: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("San Guillermo de Maleval Parish", pageW / 2, 15, { align: "center" });
  doc.setFontSize(12);
  doc.text("Church Transactions Record", pageW / 2, 22, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${summary.from} to ${summary.to}`, pageW / 2, 28, { align: "center" });
  if (filterNote) {
    doc.setFontSize(9);
    doc.text(`Filtered: ${filterNote}`, pageW / 2, 33, { align: "center" });
  }

  let y = 42;
  const s = summary.sharing;
  const summaryRows: [string, string][] = [
    ["Total money in", peso(summary.income_total)],
    [`Church share (${s.church_percent}%)`, peso(s.church_amount)],
    [`Archdiocese share (${s.archdiocese_percent}%) - to be remitted`, peso(s.archdiocese_amount)],
    ["Total money out (verified expenses)", peso(summary.expense_total)],
    [summary.church_net >= 0 ? "Church net (church share - expenses)" : "Church shortfall", peso(summary.church_net)],
  ];
  doc.setFontSize(9);
  summaryRows.forEach(([label, value], i) => {
    doc.setFont("helvetica", i === summaryRows.length - 1 ? "bold" : "normal");
    doc.text(label, MARGIN_X, y);
    doc.text(value, MARGIN_X + 130, y, { align: "right" });
    y += 5.5;
  });
  y += 4;

  const columns: Column[] = [
    { header: "Date", width: 30 },
    { header: "Type", width: 30 },
    { header: "Description", width: 62 },
    { header: "Name / Payee", width: 36 },
    { header: "OR / Ref", width: 26 },
    { header: "In", width: 25, align: "right" },
    { header: "Out", width: 25, align: "right" },
    { header: "Recorded by", width: 35 },
  ];
  const totalW = columns.reduce((sum, c) => sum + c.width, 0);

  const drawRow = (cells: string[], bold: boolean, fill?: [number, number, number]) => {
    if (y + ROW_H > pageH - 12) {
      doc.addPage();
      y = 16;
      drawRow(columns.map((c) => c.header), true, [241, 245, 249]);
    }
    if (fill) {
      doc.setFillColor(...fill);
      doc.rect(MARGIN_X, y - 4.5, totalW, ROW_H, "F");
    }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    let x = MARGIN_X;
    columns.forEach((col, i) => {
      const text = doc.splitTextToSize(cells[i] ?? "", col.width - 3)[0] ?? "";
      if (col.align === "right") {
        doc.text(text, x + col.width - 1.5, y, { align: "right" });
      } else {
        doc.text(text, x + 1.5, y);
      }
      x += col.width;
    });
    doc.setDrawColor(226, 232, 240);
    doc.line(MARGIN_X, y + 2, MARGIN_X + totalW, y + 2);
    y += ROW_H;
  };

  doc.setFontSize(8);
  drawRow(columns.map((c) => c.header), true, [241, 245, 249]);
  items.forEach((e) => {
    drawRow(
      [
        e.date_time ? new Date(e.date_time).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "",
        e.type_label,
        e.description,
        e.party || "-",
        e.reference || "-",
        e.amount_in ? peso(e.amount_in) : "",
        e.amount_out ? peso(e.amount_out) : "",
        e.recorded_by || "-",
      ],
      false
    );
  });
  const inTotal = items.reduce((sum, e) => sum + e.amount_in, 0);
  const outTotal = items.reduce((sum, e) => sum + e.amount_out, 0);
  drawRow(["", "", `Total (${items.length} entr${items.length === 1 ? "y" : "ies"})`, "", "", peso(inTotal), peso(outTotal), ""], true, [248, 250, 252]);

  if (y + 28 > pageH - 10) {
    doc.addPage();
    y = 16;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, MARGIN_X, y + 4);
  doc.line(MARGIN_X, y + 18, MARGIN_X + 60, y + 18);
  doc.line(pageW - MARGIN_X - 60, y + 18, pageW - MARGIN_X, y + 18);
  doc.text("Prepared by", MARGIN_X, y + 23);
  doc.text("Noted by (Parish Priest)", pageW - MARGIN_X - 60, y + 23);

  const fileName = `Church_Transactions_${summary.from}_to_${summary.to}.pdf`;
  console.log("[HistoryPdf] Saving", fileName);
  doc.save(fileName);
};
