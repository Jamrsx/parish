import type { jsPDF } from "jspdf";
import { lineItemTotal, type GeneralReportData } from "./expenses";

const peso = (n: number) =>
  `PHP ${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Column {
  header: string;
  width: number;
  align?: "left" | "right";
}

const MARGIN_X = 14;
const ROW_H = 7;

const ensureSpace = (doc: jsPDF, y: number, needed: number): number => {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - 14) {
    doc.addPage();
    return 18;
  }
  return y;
};

const drawTable = (doc: jsPDF, startY: number, columns: Column[], rows: string[][], footer?: string[]): number => {
  let y = ensureSpace(doc, startY, ROW_H * 2);

  const drawRow = (cells: string[], bold: boolean, fill?: [number, number, number]) => {
    let x = MARGIN_X;
    const totalW = columns.reduce((s, c) => s + c.width, 0);
    if (fill) {
      doc.setFillColor(...fill);
      doc.rect(MARGIN_X, y - 5, totalW, ROW_H, "F");
    }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    columns.forEach((col, i) => {
      const raw = cells[i] ?? "";
      const text = doc.splitTextToSize(raw, col.width - 3)[0] ?? "";
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

  doc.setFontSize(9);
  drawRow(columns.map((c) => c.header), true, [241, 245, 249]);
  rows.forEach((r) => {
    y = ensureSpace(doc, y, ROW_H);
    drawRow(r, false);
  });
  if (footer) {
    y = ensureSpace(doc, y, ROW_H);
    drawRow(footer, true, [248, 250, 252]);
  }
  return y + 4;
};

const sectionTitle = (doc: jsPDF, y: number, title: string): number => {
  y = ensureSpace(doc, y, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, MARGIN_X, y);
  return y + 6;
};

export const downloadGeneralReportPdf = async (report: GeneralReportData): Promise<void> => {
  console.log("[GeneralReportPdf] Loading PDF library...");
  const { jsPDF: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("San Guillermo de Maleval Parish", pageW / 2, 16, { align: "center" });
  doc.setFontSize(12);
  doc.text(
    report.period === "monthly" ? "Monthly General Report" : "Weekly General Report",
    pageW / 2,
    23,
    { align: "center" }
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${report.label}  (${report.start_date} to ${report.end_date})`, pageW / 2, 29, { align: "center" });

  let y = 40;

  y = sectionTitle(doc, y, "Summary");
  y = drawTable(
    doc,
    y,
    [
      { header: "Item", width: 120 },
      { header: "Amount", width: 62, align: "right" },
    ],
    [
      ["Total income", peso(report.income.total)],
      ["Total verified expenses", peso(report.expenses.total)],
      [report.net >= 0 ? "Net income" : "Net loss", peso(report.net)],
      [
        `Pending verification (${report.pending_verification.count} item/s, not included)`,
        peso(report.pending_verification.amount),
      ],
    ]
  );

  y = sectionTitle(doc, y, "Income");
  y = drawTable(
    doc,
    y,
    [
      { header: "Source", width: 120 },
      { header: "Amount", width: 62, align: "right" },
    ],
    [
      ["Service fees", peso(report.income.service_fees)],
      ["Mass collections", peso(report.income.mass_collections)],
      ["Donations / Love offerings", peso(report.income.donations)],
      ["Special intentions", peso(report.income.special_intentions)],
    ],
    ["Total income", peso(report.income.total)]
  );

  y = sectionTitle(doc, y, "Expenses by category");
  y = drawTable(
    doc,
    y,
    [
      { header: "Category", width: 90 },
      { header: "Entries", width: 30, align: "right" },
      { header: "Amount", width: 62, align: "right" },
    ],
    report.expenses.by_category.map((c) => [c.label, String(c.count), peso(c.amount)]),
    ["Total expenses", String(report.expenses.count), peso(report.expenses.total)]
  );

  if (report.period === "monthly" && report.weekly_breakdown.length > 0) {
    y = sectionTitle(doc, y, "Weekly breakdown");
    y = drawTable(
      doc,
      y,
      [
        { header: "Week", width: 52 },
        { header: "Income", width: 43, align: "right" },
        { header: "Expenses", width: 43, align: "right" },
        { header: "Net", width: 44, align: "right" },
      ],
      report.weekly_breakdown.map((w) => [
        `${w.label} (${w.start_date.slice(5)} to ${w.end_date.slice(5)})`,
        peso(w.income),
        peso(w.expenses),
        peso(w.net),
      ])
    );
  }

  if (report.expenses.items.length > 0) {
    y = sectionTitle(doc, y, "Expense details (verified)");
    y = drawTable(
      doc,
      y,
      [
        { header: "Date", width: 22 },
        { header: "Category", width: 32 },
        { header: "Description", width: 62 },
        { header: "Paid to", width: 36 },
        { header: "Amount", width: 30, align: "right" },
      ],
      report.expenses.items.flatMap((e) => {
        const items = e.line_items || [];
        const isPerson = items.length > 0 && items[0].quantity === undefined;
        const main = [
          e.expense_date,
          e.category_label,
          e.reference_no ? `${e.description} (OR ${e.reference_no})` : e.description,
          isPerson ? `${items.length} person(s)` : e.payee_name || "-",
          peso(e.amount),
        ];
        const detail = items.map((item) => [
          "",
          "",
          item.quantity !== undefined
            ? `   - ${item.name} (${item.quantity} x ${peso(Number(item.unit_price || 0))})`
            : `   - ${item.name}`,
          "",
          peso(lineItemTotal(item)),
        ]);
        return [main, ...detail];
      })
    );
  }

  y = ensureSpace(doc, y, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date(report.generated_at).toLocaleString()}`, MARGIN_X, y + 4);
  doc.line(MARGIN_X, y + 20, MARGIN_X + 60, y + 20);
  doc.line(pageW - MARGIN_X - 60, y + 20, pageW - MARGIN_X, y + 20);
  doc.text("Prepared by (Cashier)", MARGIN_X, y + 25);
  doc.text("Noted by (Parish Priest)", pageW - MARGIN_X - 60, y + 25);

  const fileName =
    report.period === "monthly"
      ? `General_Report_${report.start_date.slice(0, 7)}.pdf`
      : `Weekly_Report_${report.start_date}_to_${report.end_date}.pdf`;
  console.log("[GeneralReportPdf] Saving", fileName);
  doc.save(fileName);
};
