import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, FileDown, LogOut, PieChart, RefreshCw, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import { priestAPI } from '../../../../library/priest';
import {
  EXPENSE_CATEGORIES,
  getApiErrorMessage,
  lineItemPeople,
  lineItemsSummary,
  type ExpenseRow,
  type GeneralReportData,
  type GeneralReportParams,
} from '../../../../library/expenses';
import { downloadGeneralReportPdf } from '../../../../library/generalReportPdf';
import { HorizontalBarChart } from '../components/MonthlyCharts';
import ExpenseItemsModal from '../components/ExpenseItemsModal';
import PriestNav from './PriestNav';

const PAGE_SIZE = 10;

const formatPeso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const mondayOfThisWeek = () => {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return toDateInput(d);
};

const addDays = (ymd: string, days: number) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toDateInput(date);
};

const monthRange = (ym: string): [string, string] => {
  const [y, m] = ym.split('-').map(Number);
  return [toDateInput(new Date(y, m - 1, 1)), toDateInput(new Date(y, m, 0))];
};

const formatMonthLabel = (ym?: string | null) => {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

const PriestExpenses: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [period, setPeriod] = useState<'monthly' | 'weekly'>('monthly');
  const [month, setMonth] = useState(thisMonth);
  const [weekStart, setWeekStart] = useState(mondayOfThisWeek());

  const [report, setReport] = useState<GeneralReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);

  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'verified' | 'forwarded'>('verified');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [itemsPreview, setItemsPreview] = useState<ExpenseRow | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const params: GeneralReportParams | null = useMemo(() => {
    if (period === 'monthly') {
      const [y, m] = month.split('-').map(Number);
      return y && m ? { period: 'monthly', year: y, month: m } : null;
    }
    return weekStart ? { period: 'weekly', week_start: weekStart } : null;
  }, [period, month, weekStart]);

  const range: [string, string] | null = useMemo(() => {
    if (period === 'monthly') return month ? monthRange(month) : null;
    return weekStart ? [weekStart, addDays(weekStart, 6)] : null;
  }, [period, month, weekStart]);

  const fetchReport = useCallback(async () => {
    if (!params) {
      setReportError(period === 'monthly' ? 'Select a month.' : "Select the week's start date.");
      return;
    }
    try {
      setReportLoading(true);
      setReportError(null);
      const res = await priestAPI.getGeneralReport(params);
      if (!res.data?.success) throw new Error(res.data?.message || 'Failed to load summary.');
      setReport(res.data.data);
      console.log('[PriestExpenses] Summary loaded', res.data.data);
    } catch (err) {
      console.error('[PriestExpenses] Summary error:', err);
      setReport(null);
      setReportError(getApiErrorMessage(err, 'Failed to load the expense summary. Please try again.'));
    } finally {
      setReportLoading(false);
    }
  }, [params, period]);

  const fetchList = useCallback(async () => {
    if (!range) return;
    try {
      setListLoading(true);
      setListError(null);
      const res = await priestAPI.getExpenses({
        status: statusFilter,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        date_from: range[0],
        date_to: range[1],
        per_page: 500,
      });
      if (!res.data?.success) throw new Error(res.data?.message || 'Failed to load expenses.');
      const data = res.data.data;
      setRows(Array.isArray(data) ? data : data?.data || []);
    } catch (err) {
      console.error('[PriestExpenses] List error:', err);
      setRows([]);
      setListError(getApiErrorMessage(err, 'Failed to load expenses. Please try again.'));
    } finally {
      setListLoading(false);
    }
  }, [range, statusFilter, categoryFilter]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    setPage(1);
  }, [range, statusFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const listTotal = useMemo(() => rows.reduce((s, r) => s + Number(r.amount || 0), 0), [rows]);

  const expenseBars =
    report?.expenses.by_category
      .filter((c) => c.amount > 0)
      .map((c) => ({ label: c.label, value: c.amount, percentage: c.percentage })) || [];

  const handlePdf = async () => {
    if (!report) return;
    try {
      setGeneratingPdf(true);
      await downloadGeneralReportPdf(report);
    } catch (err) {
      console.error('[PriestExpenses] PDF error:', err);
      alert('Could not generate the PDF. Please try again.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleRefresh = () => {
    fetchReport();
    fetchList();
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <span>⛪</span> Priest Dashboard
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              Welcome, {user?.full_name || 'Priest'} — church expenses (view only)
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition self-start"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        <PriestNav />

        <div className="mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Church Expenses</h2>
            <p className="text-sm text-slate-500 mt-1">
              Expenses compiled by the secretary and verified by the cashier. No changes can be made here.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1" role="tablist" aria-label="Period">
              {(['monthly', 'weekly'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={period === p}
                  onClick={() => {
                    console.log('[PriestExpenses] Period:', p);
                    setPeriod(p);
                  }}
                  className={`px-3 py-1.5 text-sm rounded-md font-medium ${
                    period === p ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p === 'monthly' ? 'Monthly' : 'Weekly'}
                </button>
              ))}
            </div>
            {period === 'monthly' ? (
              <input
                type="month"
                value={month}
                max={thisMonth}
                onChange={(e) => setMonth(e.target.value)}
                aria-label="Month"
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              />
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
              </label>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={reportLoading || listLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${reportLoading || listLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handlePdf}
              disabled={!report || reportLoading || generatingPdf}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              <FileDown className="w-4 h-4" />
              {generatingPdf ? 'Generating...' : 'Download PDF'}
            </button>
          </div>
        </div>

        {reportError ? (
          <div className="mb-6 bg-white rounded-xl border border-red-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-red-600">{reportError}</p>
            <button type="button" onClick={fetchReport} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
              Retry
            </button>
          </div>
        ) : reportLoading || !report ? (
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={`pe-skel-${i}`} className="h-24 rounded-xl border border-slate-200 bg-white animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="mb-6 space-y-4">
            <p className="text-sm font-semibold text-slate-700">
              {report.label}{' '}
              <span className="font-normal text-slate-500">
                ({report.start_date} to {report.end_date})
              </span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-blue-700 uppercase">Total income</p>
                  <TrendingUp size={18} className="text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-slate-900 mt-2">{formatPeso(report.income.total)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-red-700 uppercase">Verified expenses</p>
                  <TrendingDown size={18} className="text-red-600" />
                </div>
                <p className="text-2xl font-bold text-slate-900 mt-2">{formatPeso(report.expenses.total)}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {report.expenses.count} entr{report.expenses.count === 1 ? 'y' : 'ies'}
                </p>
              </div>
              <div
                className={`rounded-xl border p-4 ${
                  report.net >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className={`text-xs font-semibold uppercase ${report.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {report.net >= 0 ? 'Net income' : 'Net loss'}
                  </p>
                  <Wallet size={18} className={report.net >= 0 ? 'text-emerald-600' : 'text-red-600'} />
                </div>
                <p className={`text-2xl font-bold mt-2 ${report.net >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                  {formatPeso(report.net)}
                </p>
              </div>
            </div>

            {report.pending_verification.count > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>
                  {report.pending_verification.count} expense(s) worth{' '}
                  <span className="font-semibold">{formatPeso(report.pending_verification.amount)}</span> are awaiting the
                  cashier's verification and are not included in the totals.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <PieChart size={18} className="text-blue-600" />
                  <h3 className="text-sm font-semibold text-slate-900">Expenses by category</h3>
                </div>
                <HorizontalBarChart
                  bars={expenseBars}
                  emptyMessage="No verified expenses for this period"
                  valueFormatter={(v) => formatPeso(v)}
                />
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900">Category summary</h3>
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {report.expenses.by_category.map((c) => (
                      <tr key={c.category} className={c.amount === 0 ? 'text-slate-400' : ''}>
                        <td className="px-5 py-2">{c.label}</td>
                        <td className="px-5 py-2 text-right">{c.count}</td>
                        <td className="px-5 py-2 text-right font-medium">{formatPeso(c.amount)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-semibold">
                      <td className="px-5 py-2">Total</td>
                      <td className="px-5 py-2 text-right">{report.expenses.count}</td>
                      <td className="px-5 py-2 text-right">{formatPeso(report.expenses.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-800">
              Expense list
              {period === 'monthly' && month && (
                <span className="font-normal text-slate-500 text-sm"> · {formatMonthLabel(month)}</span>
              )}
            </h3>
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1" role="tablist" aria-label="Status">
                {(['verified', 'forwarded'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1 text-xs rounded-md font-semibold ${
                      statusFilter === s ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {s === 'verified' ? 'Verified' : 'Awaiting cashier'}
                  </button>
                ))}
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Category"
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="all">All categories</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
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
                {listLoading && rows.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`pe-row-skel-${i}`} className="animate-pulse">
                      {Array.from({ length: 5 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 rounded bg-slate-200 w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : listError ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center">
                      <p className="text-sm text-red-600 mb-3">{listError}</p>
                      <button type="button" onClick={fetchList} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
                        Retry
                      </button>
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      {statusFilter === 'verified'
                        ? 'No verified expenses for this period'
                        : 'No expenses awaiting the cashier for this period'}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => (
                    <tr key={row.expense_id}>
                      <td className="px-4 py-3 align-top whitespace-nowrap">{row.expense_date}</td>
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium text-slate-800">{row.category_label}</p>
                        {row.billing_period && (
                          <p className="text-xs text-slate-500">Billing: {formatMonthLabel(row.billing_period)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top max-w-[280px]">
                        <p className="text-slate-800 break-words">{row.description}</p>
                        {row.reference_no && <p className="text-xs text-slate-500">OR/Ref: {row.reference_no}</p>}
                        {lineItemsSummary(row.category, row.line_items) && (
                          <button
                            type="button"
                            onClick={() => setItemsPreview(row)}
                            className="mt-1 text-xs font-semibold text-blue-600 hover:underline"
                          >
                            {lineItemsSummary(row.category, row.line_items)} · View
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-slate-600">
                        {lineItemPeople(row.category, row.line_items) || row.payee_name || '—'}
                      </td>
                      <td className="px-4 py-3 align-top text-right font-semibold whitespace-nowrap">
                        {formatPeso(row.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {rows.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 text-sm">
              <p className="text-slate-500">
                {rows.length} expense(s) · Total{' '}
                <span className="font-semibold text-slate-800">{formatPeso(listTotal)}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-slate-100 rounded-lg disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-slate-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 bg-slate-100 rounded-lg disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {itemsPreview && (
        <ExpenseItemsModal
          category={itemsPreview.category}
          categoryLabel={itemsPreview.category_label}
          description={itemsPreview.description}
          items={itemsPreview.line_items || []}
          total={itemsPreview.amount}
          onClose={() => setItemsPreview(null)}
        />
      )}
    </div>
  );
};

export default PriestExpenses;
