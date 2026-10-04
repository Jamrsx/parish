import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Church,
  FileDown,
  PieChart,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  expenseAPI,
  getApiErrorMessage,
  getExpenseCategory,
  lineItemPeople,
  lineItemTotal,
  type GeneralReportData,
  type GeneralReportParams,
} from "../../../../library/expenses";
import { downloadGeneralReportPdf } from "../../../../library/generalReportPdf";
import { CashierStatSkeleton } from "./CashierSkeletons";
import { HorizontalBarChart } from "../components/MonthlyCharts";

const formatPeso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const mondayOfThisWeek = () => {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return toDateInput(d);
};

const addDays = (ymd: string, days: number) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toDateInput(date);
};

const GeneralReport: React.FC = () => {
  const now = new Date();
  const [period, setPeriod] = useState<"monthly" | "weekly">("monthly");
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [weekStart, setWeekStart] = useState(mondayOfThisWeek());
  const [report, setReport] = useState<GeneralReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const params: GeneralReportParams | null = useMemo(() => {
    if (period === "monthly") {
      const [y, m] = month.split("-").map(Number);
      return y && m ? { period: "monthly", year: y, month: m } : null;
    }
    return weekStart ? { period: "weekly", week_start: weekStart } : null;
  }, [period, month, weekStart]);

  const fetchReport = useCallback(async () => {
    if (!params) {
      setError(period === "monthly" ? "Select a month." : "Select the week's start date.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await expenseAPI.generalReport(params);
      if (!res.data?.success) throw new Error(res.data?.message || "Failed to generate report.");
      setReport(res.data.data);
      console.log("[GeneralReport] Loaded", res.data.data);
    } catch (err) {
      console.error("[GeneralReport] Error:", err);
      setReport(null);
      setError(getApiErrorMessage(err, "Failed to generate the report. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [params, period]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handlePdf = async () => {
    if (!report) {
      alert("Generate the report first.");
      return;
    }
    try {
      setGeneratingPdf(true);
      await downloadGeneralReportPdf(report);
    } catch (err) {
      console.error("[GeneralReport] PDF error:", err);
      alert("Could not generate the PDF. Please try again.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const expenseBars =
    report?.expenses.by_category
      .filter((c) => c.amount > 0)
      .map((c) => ({ label: c.label, value: c.amount, percentage: c.percentage })) || [];

  const incomeRows = report
    ? [
        { label: "Service fees", value: report.income.service_fees },
        { label: "Mass collections", value: report.income.mass_collections },
        { label: "Donations / Love offerings", value: report.income.donations },
        { label: "Special intentions", value: report.income.special_intentions },
      ]
    : [];

  const sharing = report?.sharing;
  const churchNet = report ? (sharing ? (report.church_net ?? report.net) : report.net) : 0;

  return (
    <div>
      <div className="mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">General Report</h1>
          <p className="text-sm text-slate-500 mt-1">
            Church share of parish income minus verified church expenses, by month or by week
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1" role="tablist" aria-label="Report period">
            {(["monthly", "weekly"] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={period === p}
                onClick={() => {
                  console.log("[GeneralReport] Period:", p);
                  setPeriod(p);
                }}
                className={`px-3 py-1.5 text-sm rounded-md font-medium ${
                  period === p ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {p === "monthly" ? "Monthly" : "Weekly"}
              </button>
            ))}
          </div>
          {period === "monthly" ? (
            <label className="flex flex-col text-xs font-medium text-slate-600">
              Month
              <input
                type="month"
                value={month}
                max={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`}
                onChange={(e) => setMonth(e.target.value)}
                className="mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              />
            </label>
          ) : (
            <label className="flex flex-col text-xs font-medium text-slate-600">
              Week starting
              <input
                type="date"
                value={weekStart}
                max={toDateInput(now)}
                onChange={(e) => setWeekStart(e.target.value)}
                className="mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              />
              {weekStart && (
                <span className="mt-1 text-[11px] text-slate-500">
                  {weekStart} to {addDays(weekStart, 6)}
                </span>
              )}
            </label>
          )}
          <button
            type="button"
            onClick={fetchReport}
            disabled={loading}
            className="px-4 py-2 bg-slate-100 rounded-lg text-sm disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={handlePdf}
            disabled={!report || loading || generatingPdf}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            <FileDown size={16} />
            {generatingPdf ? "Generating..." : "Download PDF"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-white rounded-xl border border-red-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-red-600">{error}</p>
          <button type="button" onClick={fetchReport} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
            Retry
          </button>
        </div>
      ) : loading || !report ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <CashierStatSkeleton key={`gr-skel-${i}`} />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-sm font-semibold text-slate-700">
            {report.label}{" "}
            <span className="font-normal text-slate-500">
              ({report.start_date} to {report.end_date})
            </span>
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-blue-700 uppercase">Total income</p>
                <TrendingUp size={18} className="text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">{formatPeso(report.income.total)}</p>
              {sharing && (
                <p className="text-xs text-slate-500 mt-1">
                  Split {sharing.church_percent}% / {sharing.archdiocese_percent}%
                </p>
              )}
            </div>
            {sharing && (
              <>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-emerald-700 uppercase">Church share ({sharing.church_percent}%)</p>
                    <Church size={18} className="text-emerald-600" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900 mt-2">{formatPeso(sharing.church_amount)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-indigo-700 uppercase">
                      Archdiocese share ({sharing.archdiocese_percent}%)
                    </p>
                    <Building2 size={18} className="text-indigo-600" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900 mt-2">{formatPeso(sharing.archdiocese_amount)}</p>
                  <p className="text-xs text-slate-500 mt-1">To be remitted</p>
                </div>
              </>
            )}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-red-700 uppercase">Verified expenses</p>
                <TrendingDown size={18} className="text-red-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">{formatPeso(report.expenses.total)}</p>
              <p className="text-xs text-slate-500 mt-1">{report.expenses.count} entr{report.expenses.count === 1 ? "y" : "ies"}</p>
            </div>
            <div
              className={`rounded-xl border p-4 shadow-sm ${
                churchNet >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className={`text-xs font-semibold uppercase ${churchNet >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {sharing ? (churchNet >= 0 ? "Church net" : "Church shortfall") : churchNet >= 0 ? "Net income" : "Net loss"}
                </p>
                <Wallet size={18} className={churchNet >= 0 ? "text-emerald-600" : "text-red-600"} />
              </div>
              <p className={`text-2xl font-bold mt-2 ${churchNet >= 0 ? "text-emerald-800" : "text-red-800"}`}>
                {formatPeso(churchNet)}
              </p>
              {sharing && <p className="text-xs text-slate-500 mt-1">Church share − expenses</p>}
            </div>
          </div>

          {report.pending_verification.count > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                {report.pending_verification.count} forwarded expense(s) worth{" "}
                <span className="font-semibold">{formatPeso(report.pending_verification.amount)}</span> are still awaiting
                your verification and are not included above.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <PieChart size={18} className="text-blue-600" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Expenses by category</h3>
                  <p className="text-xs text-slate-500">Share of verified expenses</p>
                </div>
              </div>
              <HorizontalBarChart
                bars={expenseBars}
                emptyMessage="No verified expenses for this period"
                valueFormatter={(v) => formatPeso(v)}
              />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Income breakdown</h3>
              <div className="divide-y divide-slate-100">
                {incomeRows.map((row) => (
                  <div key={row.label} className="flex justify-between py-2.5 text-sm">
                    <span className="text-slate-600">{row.label}</span>
                    <span className="font-semibold text-slate-900">{formatPeso(row.value)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2.5 text-sm">
                  <span className="font-semibold text-slate-800">Total income</span>
                  <span className="font-bold text-blue-700">{formatPeso(report.income.total)}</span>
                </div>
                {sharing && (
                  <>
                    <div className="flex justify-between py-2.5 text-sm">
                      <span className="text-emerald-700">Church share ({sharing.church_percent}%)</span>
                      <span className="font-semibold text-emerald-800">{formatPeso(sharing.church_amount)}</span>
                    </div>
                    <div className="flex justify-between py-2.5 text-sm">
                      <span className="text-indigo-700">Archdiocese share ({sharing.archdiocese_percent}%)</span>
                      <span className="font-semibold text-indigo-800">{formatPeso(sharing.archdiocese_amount)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Expense summary by category</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-2.5">Category</th>
                    <th className="text-right px-4 py-2.5">Entries</th>
                    <th className="text-right px-4 py-2.5">Amount</th>
                    <th className="text-right px-4 py-2.5">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.expenses.by_category.map((c) => (
                    <tr key={c.category} className={c.amount === 0 ? "text-slate-400" : ""}>
                      <td className="px-4 py-2.5">{c.label}</td>
                      <td className="px-4 py-2.5 text-right">{c.count}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatPeso(c.amount)}</td>
                      <td className="px-4 py-2.5 text-right">{c.percentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="px-4 py-2.5">Total</td>
                    <td className="px-4 py-2.5 text-right">{report.expenses.count}</td>
                    <td className="px-4 py-2.5 text-right">{formatPeso(report.expenses.total)}</td>
                    <td className="px-4 py-2.5 text-right">{report.expenses.total > 0 ? "100%" : "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {report.period === "monthly" && report.weekly_breakdown.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900">Weekly breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left px-4 py-2.5">Week</th>
                      <th className="text-left px-4 py-2.5">Dates</th>
                      <th className="text-right px-4 py-2.5">Income</th>
                      {sharing && (
                        <>
                          <th className="text-right px-4 py-2.5">Church ({sharing.church_percent}%)</th>
                          <th className="text-right px-4 py-2.5">Archdiocese ({sharing.archdiocese_percent}%)</th>
                        </>
                      )}
                      <th className="text-right px-4 py-2.5">Expenses</th>
                      <th className="text-right px-4 py-2.5">{sharing ? "Church net" : "Net"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.weekly_breakdown.map((w) => {
                      const rowNet = sharing ? (w.church_net ?? w.net) : w.net;
                      return (
                        <tr key={w.label}>
                          <td className="px-4 py-2.5 font-medium">{w.label}</td>
                          <td className="px-4 py-2.5 text-slate-500">
                            {w.start_date} to {w.end_date}
                          </td>
                          <td className="px-4 py-2.5 text-right">{formatPeso(w.income)}</td>
                          {sharing && (
                            <>
                              <td className="px-4 py-2.5 text-right">{formatPeso(w.church_share ?? 0)}</td>
                              <td className="px-4 py-2.5 text-right">{formatPeso(w.archdiocese_share ?? 0)}</td>
                            </>
                          )}
                          <td className="px-4 py-2.5 text-right">{formatPeso(w.expenses)}</td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${rowNet < 0 ? "text-red-700" : "text-emerald-700"}`}>
                            {formatPeso(rowNet)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Verified expense details</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-2.5">Date</th>
                    <th className="text-left px-4 py-2.5">Category</th>
                    <th className="text-left px-4 py-2.5">Description</th>
                    <th className="text-left px-4 py-2.5">Paid to</th>
                    <th className="text-right px-4 py-2.5">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.expenses.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-500">
                        No verified expenses for this period
                      </td>
                    </tr>
                  ) : (
                    report.expenses.items.map((e) => {
                      const mode = getExpenseCategory(e.category)?.items.mode ?? "none";
                      const items = e.line_items || [];
                      return (
                        <React.Fragment key={e.expense_id}>
                          <tr>
                            <td className="px-4 py-2.5 whitespace-nowrap align-top">{e.expense_date}</td>
                            <td className="px-4 py-2.5 align-top">{e.category_label}</td>
                            <td className="px-4 py-2.5 align-top">
                              {e.description}
                              {e.reference_no && (
                                <span className="block text-xs text-slate-500">OR/Ref: {e.reference_no}</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-slate-600 align-top">
                              {lineItemPeople(e.category, items, 3) || e.payee_name || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium align-top">{formatPeso(e.amount)}</td>
                          </tr>
                          {mode !== "none" &&
                            items.map((item, i) => (
                              <tr key={`${e.expense_id}-item-${i}`} className="bg-slate-50/60 text-xs text-slate-600">
                                <td />
                                <td />
                                <td className="px-4 py-1.5 pl-8" colSpan={2}>
                                  • {item.name}
                                  {mode === "product" && (
                                    <span className="text-slate-400">
                                      {" "}
                                      ({item.quantity} × {formatPeso(Number(item.unit_price || 0))})
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-1.5 text-right">{formatPeso(lineItemTotal(item))}</td>
                              </tr>
                            ))}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneralReport;
