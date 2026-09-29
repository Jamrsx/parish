import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, RotateCcw, Receipt } from "lucide-react";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUS_LABELS,
  expenseAPI,
  getApiErrorMessage,
  lineItemPeople,
  lineItemsSummary,
  type ExpenseRow,
  type ExpenseStatus,
} from "../../../../library/expenses";
import { CashierTableSkeleton } from "./CashierSkeletons";
import ExpenseItemsModal from "../components/ExpenseItemsModal";

const PAGE_SIZE = 10;

const formatPeso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatMonthLabel = (ym?: string | null) => {
  if (!ym) return "";
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
};

const STATUS_STYLES: Record<ExpenseStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  forwarded: "bg-amber-100 text-amber-800",
  verified: "bg-emerald-100 text-emerald-800",
  returned: "bg-red-100 text-red-700",
};

interface Props {
  onChanged?: () => void;
}

const ExpenseReview: React.FC<Props> = ({ onChanged }) => {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"forwarded" | "verified" | "returned">("forwarded");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [confirmVerify, setConfirmVerify] = useState<{ ids: number[]; total: number } | null>(null);
  const [returnTarget, setReturnTarget] = useState<ExpenseRow | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [itemsPreview, setItemsPreview] = useState<ExpenseRow | null>(null);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      console.log("[ExpenseReview] Fetching", { statusFilter, categoryFilter, monthFilter });
      const res = await expenseAPI.list({
        status: statusFilter,
        category: categoryFilter === "all" ? undefined : categoryFilter,
        month: monthFilter || undefined,
        per_page: 500,
      });
      if (res.data?.success) {
        const data = res.data.data;
        setRows(Array.isArray(data) ? data : data?.data || []);
      }
    } catch (err) {
      console.error("[ExpenseReview] Load error:", err);
      setFeedback({ type: "error", text: getApiErrorMessage(err, "Failed to load expenses.") });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, monthFilter]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [statusFilter, categoryFilter, monthFilter]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const listTotal = useMemo(() => rows.reduce((s, r) => s + Number(r.amount || 0), 0), [rows]);

  const canAct = statusFilter === "forwarded";
  const pageIds = pageRows.map((r) => r.expense_id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const selectedTotal = rows
    .filter((r) => selectedIds.includes(r.expense_id))
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  const askVerify = (ids: number[]) => {
    const total = rows.filter((r) => ids.includes(r.expense_id)).reduce((s, r) => s + Number(r.amount || 0), 0);
    setConfirmVerify({ ids, total });
  };

  const doVerify = async () => {
    if (!confirmVerify) return;
    setBusy(true);
    try {
      const res = await expenseAPI.verify(confirmVerify.ids);
      if (!res.data?.success) throw new Error(res.data?.message);
      setFeedback({ type: "success", text: res.data.message || "Expenses verified." });
      setSelectedIds((prev) => prev.filter((id) => !confirmVerify.ids.includes(id)));
      setConfirmVerify(null);
      fetchRows();
      onChanged?.();
    } catch (err) {
      console.error("[ExpenseReview] Verify error:", err);
      setFeedback({ type: "error", text: getApiErrorMessage(err, "Failed to verify expenses.") });
      setConfirmVerify(null);
    } finally {
      setBusy(false);
    }
  };

  const doReturn = async () => {
    if (!returnTarget) return;
    if (returnReason.trim().length < 5) {
      alert("Please give a reason for returning (at least 5 characters).");
      return;
    }
    setBusy(true);
    try {
      const res = await expenseAPI.returnToSecretary(returnTarget.expense_id, returnReason.trim());
      if (!res.data?.success) throw new Error(res.data?.message);
      setFeedback({ type: "success", text: "Expense returned to the secretary." });
      setSelectedIds((prev) => prev.filter((id) => id !== returnTarget.expense_id));
      setReturnTarget(null);
      setReturnReason("");
      fetchRows();
      onChanged?.();
    } catch (err) {
      console.error("[ExpenseReview] Return error:", err);
      alert(getApiErrorMessage(err, "Failed to return expense."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Expense Review</h1>
        <p className="text-sm text-slate-500 mt-1">
          Verify church expenses forwarded by the secretary, or return them with a reason
        </p>
      </div>

      {feedback && (
        <div
          role="status"
          className={`mb-4 px-4 py-3 rounded-lg text-sm flex items-start justify-between gap-3 ${
            feedback.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
          }`}
        >
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-xs font-semibold underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1" role="tablist">
          {(["forwarded", "verified", "returned"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={statusFilter === s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium ${
                statusFilter === s ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {EXPENSE_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
          aria-label="Category filter"
        >
          <option value="all">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
          aria-label="Month filter"
        />
        {monthFilter && (
          <button type="button" onClick={() => setMonthFilter("")} className="text-xs text-slate-500 hover:text-slate-800">
            All months
          </button>
        )}
        <button
          type="button"
          onClick={fetchRows}
          disabled={loading}
          className="px-4 py-2 bg-slate-100 rounded-lg text-sm disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {canAct && selectedIds.length > 0 && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm text-emerald-900">
            <span className="font-semibold">{selectedIds.length}</span> selected · {formatPeso(selectedTotal)}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => askVerify(selectedIds)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              <CheckCircle2 size={15} /> Verify selected
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {canAct && (
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all on this page"
                      checked={allPageSelected}
                      disabled={pageIds.length === 0}
                      onChange={() =>
                        setSelectedIds((prev) =>
                          allPageSelected
                            ? prev.filter((id) => !pageIds.includes(id))
                            : Array.from(new Set([...prev, ...pageIds]))
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </th>
                )}
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Description</th>
                <th className="text-left px-4 py-3">Paid to</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Secretary</th>
                <th className="text-left px-4 py-3">Status</th>
                {canAct && <th className="text-right px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && rows.length === 0 ? (
                <CashierTableSkeleton columns={canAct ? 9 : 7} />
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={canAct ? 9 : 7} className="py-16 text-center text-slate-500">
                    <Receipt className="mx-auto mb-2 text-slate-300" size={32} />
                    {statusFilter === "forwarded" ? "No expenses awaiting verification" : "No expenses found"}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={row.expense_id} className={selectedIds.includes(row.expense_id) ? "bg-emerald-50/40" : ""}>
                    {canAct && (
                      <td className="px-4 py-3 align-top">
                        <input
                          type="checkbox"
                          aria-label={`Select expense ${row.description}`}
                          checked={selectedIds.includes(row.expense_id)}
                          onChange={() =>
                            setSelectedIds((prev) =>
                              prev.includes(row.expense_id)
                                ? prev.filter((x) => x !== row.expense_id)
                                : [...prev, row.expense_id]
                            )
                          }
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 align-top whitespace-nowrap">{row.expense_date}</td>
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium text-slate-800">{row.category_label}</p>
                      {row.billing_period && (
                        <p className="text-xs text-slate-500">Billing: {formatMonthLabel(row.billing_period)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top max-w-[260px]">
                      <p className="text-slate-800 break-words">{row.description}</p>
                      {row.reference_no && <p className="text-xs text-slate-500">OR/Ref: {row.reference_no}</p>}
                      {row.notes && <p className="text-xs text-slate-500 mt-0.5">{row.notes}</p>}
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
                      {lineItemPeople(row.category, row.line_items) || row.payee_name || "—"}
                    </td>
                    <td className="px-4 py-3 align-top text-right font-semibold whitespace-nowrap">
                      {formatPeso(row.amount)}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-600">{row.recorded_by || "—"}</td>
                    <td className="px-4 py-3 align-top">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_STYLES[row.status]}`}>
                        {EXPENSE_STATUS_LABELS[row.status]}
                      </span>
                      {row.status === "returned" && row.return_reason && (
                        <p className="text-xs text-red-600 mt-1 max-w-[200px]">{row.return_reason}</p>
                      )}
                    </td>
                    {canAct && (
                      <td className="px-4 py-3 align-top">
                        <div className="inline-flex gap-1.5 whitespace-nowrap justify-end w-full">
                          <button
                            type="button"
                            onClick={() => askVerify([row.expense_id])}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100"
                          >
                            <CheckCircle2 size={13} /> Verify
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReturnTarget(row);
                              setReturnReason("");
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 rounded-lg hover:bg-red-100"
                          >
                            <RotateCcw size={13} /> Return
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {rows.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 text-sm">
            <p className="text-slate-500">
              {rows.length} expense(s) · Total <span className="font-semibold text-slate-800">{formatPeso(listTotal)}</span>
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

      {confirmVerify && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-clear bg-opacity-20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" role="alertdialog" aria-modal="true">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Verify expenses?</h3>
            <p className="text-sm text-slate-600 mb-5">
              {confirmVerify.ids.length} expense(s) totaling{" "}
              <span className="font-semibold text-slate-900">{formatPeso(confirmVerify.total)}</span> will be counted in
              the general report.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmVerify(null)}
                disabled={busy}
                className="px-4 py-2 bg-slate-100 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doVerify}
                disabled={busy}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {busy ? "Verifying..." : "Verify"}
              </button>
            </div>
          </div>
        </div>
      )}

      {returnTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-clear bg-opacity-20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" role="dialog" aria-modal="true">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Return to secretary</h3>
            <p className="text-sm text-slate-500 mb-4">
              {returnTarget.category_label} · {returnTarget.description} · {formatPeso(returnTarget.amount)}
            </p>
            <label htmlFor="return-reason" className="text-sm font-medium text-slate-700">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              id="return-reason"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g. Amount does not match the receipt"
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1">At least 5 characters. The secretary will see this reason.</p>
            <div className="flex gap-3 justify-end mt-5">
              <button
                type="button"
                onClick={() => setReturnTarget(null)}
                disabled={busy}
                className="px-4 py-2 bg-slate-100 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doReturn}
                disabled={busy || returnReason.trim().length < 5}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {busy ? "Returning..." : "Return"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseReview;
