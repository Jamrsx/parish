import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Pencil,
  Plus,
  Receipt,
  RotateCcw,
  Send,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUS_LABELS,
  expenseAPI,
  getApiErrorMessage,
  getExpenseCategory,
  lineItemPeople,
  lineItemsSummary,
  type ExpenseCategory,
  type ExpensePayload,
  type ExpenseRow,
  type ExpenseStatus,
  type ExpenseSummary,
} from "../../../../library/expenses";
import {
  editableRowTotal,
  newEditableLineItem,
  toEditableLineItems,
  toPayloadLineItems,
  validateEditableLineItems,
  type EditableLineItem,
} from "../../../../library/expenseLineItems";
import SecretaryStatCard from "./components/SecretaryStatCard";
import ModalCloseButton from "./components/ModalCloseButton";
import ExpenseLineItemsEditor from "./components/ExpenseLineItemsEditor";
import ExpenseItemsModal from "../components/ExpenseItemsModal";
import PesoInput from "../../../components/PesoInput";
import { toPesoInputValue } from "../../../../library/pesoInput";
import { SecretaryStatSkeleton, SecretaryTableSkeleton } from "./components/SecretarySkeletons";

const PAGE_SIZE = 10;

const formatPeso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const currentMonth = () => todayLocal().slice(0, 7);

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

const isEditable = (row: ExpenseRow) => row.status === "draft" || row.status === "returned";

interface FormState {
  category: ExpenseCategory | "";
  description: string;
  payee_name: string;
  amount: string;
  expense_date: string;
  billing_period: string;
  reference_no: string;
  notes: string;
}

type FormErrors = Partial<Record<keyof FormState | "line_items", string>>;

const emptyForm = (): FormState => ({
  category: "",
  description: "",
  payee_name: "",
  amount: "",
  expense_date: todayLocal(),
  billing_period: currentMonth(),
  reference_no: "",
  notes: "",
});

type ConfirmState =
  | { kind: "forward"; ids: number[]; total: number; all?: boolean; breakdown?: { label: string; count: number }[] }
  | { kind: "delete"; row: ExpenseRow }
  | null;

const ManageExpenses: React.FC = () => {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [monthFilter, setMonthFilter] = useState(currentMonth());
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [lineItems, setLineItems] = useState<EditableLineItem[]>([newEditableLineItem()]);
  const [lineItemErrors, setLineItemErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [itemsPreview, setItemsPreview] = useState<ExpenseRow | null>(null);

  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      console.log("[ManageExpenses] Fetching", { monthFilter, categoryFilter, statusFilter });
      const res = await expenseAPI.list({
        month: monthFilter || undefined,
        category: categoryFilter === "all" ? undefined : categoryFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
        per_page: 500,
      });
      if (!res.data?.success) throw new Error(res.data?.message || "Failed to load expenses.");
      const data = res.data.data;
      setRows(Array.isArray(data) ? data : data?.data || []);
      setSummary(res.data.summary || null);
      console.log("[ManageExpenses] Loaded", res.data.summary);
    } catch (err) {
      console.error("[ManageExpenses] Load error:", err);
      setLoadError(getApiErrorMessage(err, "Failed to load expenses. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [monthFilter, categoryFilter, statusFilter]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [monthFilter, categoryFilter, statusFilter, search]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.description, r.payee_name, r.reference_no, r.category_label]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const filteredTotal = useMemo(
    () => filteredRows.reduce((sum, r) => sum + Number(r.amount || 0), 0),
    [filteredRows]
  );

  const selectableOnPage = pageRows.filter(isEditable).map((r) => r.expense_id);
  const allPageSelected =
    selectableOnPage.length > 0 && selectableOnPage.every((id) => selectedIds.includes(id));

  const selectedTotal = useMemo(
    () =>
      rows
        .filter((r) => selectedIds.includes(r.expense_id))
        .reduce((sum, r) => sum + Number(r.amount || 0), 0),
    [rows, selectedIds]
  );

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectPage = () => {
    setSelectedIds((prev) =>
      allPageSelected
        ? prev.filter((id) => !selectableOnPage.includes(id))
        : Array.from(new Set([...prev, ...selectableOnPage]))
    );
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormErrors({});
    setLineItems([newEditableLineItem()]);
    setLineItemErrors({});
    setShowForm(true);
  };

  const openEdit = (row: ExpenseRow) => {
    setEditing(row);
    setForm({
      category: row.category,
      description: row.description,
      payee_name: row.payee_name || "",
      amount: toPesoInputValue(row.amount),
      expense_date: row.expense_date,
      billing_period: row.billing_period || currentMonth(),
      reference_no: row.reference_no || "",
      notes: row.notes || "",
    });
    setFormErrors({});
    setLineItems(toEditableLineItems(row.line_items));
    setLineItemErrors({});
    setShowForm(true);
  };

  const categoryInfo = getExpenseCategory(form.category);
  const itemMode = categoryInfo?.items.mode ?? "none";
  const isItemized = itemMode !== "none";
  const itemizedTotal = useMemo(
    () => lineItems.reduce((sum, r) => sum + editableRowTotal(r, itemMode), 0),
    [lineItems, itemMode]
  );

  const validateForm = (): { errors: FormErrors; rowErrors: Record<string, string> } => {
    const errors: FormErrors = {};
    let rowErrors: Record<string, string> = {};
    if (!form.category) errors.category = "Select a category.";
    if (form.description.trim().length < 3) errors.description = "Describe the expense (at least 3 characters).";
    if (isItemized && categoryInfo) {
      if (lineItems.length === 0) {
        errors.line_items = `Add at least one ${categoryInfo.items.noun[0]}.`;
      }
      rowErrors = validateEditableLineItems(lineItems, itemMode, {
        name: categoryInfo.items.nameLabel,
        amount: categoryInfo.items.amountLabel,
      });
      if (Object.keys(rowErrors).length > 0) {
        errors.line_items = "Fix the highlighted rows.";
      }
    } else {
      const amount = Number(form.amount);
      if (!form.amount || Number.isNaN(amount) || amount <= 0) errors.amount = "Enter an amount greater than zero.";
    }
    if (!form.expense_date) errors.expense_date = "Select the expense date.";
    else if (form.expense_date > todayLocal()) errors.expense_date = "Expense date cannot be in the future.";
    if (categoryInfo?.requiresBillingPeriod && !form.billing_period) {
      errors.billing_period = "Select the billing month.";
    }
    if (categoryInfo?.payeeRequired && !form.payee_name.trim()) {
      errors.payee_name = `${categoryInfo.payeeLabel} is required.`;
    }
    return { errors, rowErrors };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { errors, rowErrors } = validateForm();
    setFormErrors(errors);
    setLineItemErrors(rowErrors);
    if (Object.keys(errors).length > 0) {
      console.log("[ManageExpenses] Validation failed", errors, rowErrors);
      return;
    }

    const payloadItems = isItemized ? toPayloadLineItems(lineItems, itemMode) : null;
    const payload: ExpensePayload = {
      category: form.category as ExpenseCategory,
      description: form.description.trim(),
      payee_name: categoryInfo?.payeeLabel ? form.payee_name.trim() || null : null,
      amount: isItemized ? Math.round(itemizedTotal * 100) / 100 : Math.round(Number(form.amount) * 100) / 100,
      line_items: payloadItems,
      expense_date: form.expense_date,
      billing_period: categoryInfo?.requiresBillingPeriod ? form.billing_period : null,
      reference_no: form.reference_no.trim() || null,
      notes: form.notes.trim() || null,
    };

    setSubmitting(true);
    try {
      const res = editing
        ? await expenseAPI.update(editing.expense_id, payload)
        : await expenseAPI.create(payload);
      if (!res.data?.success) throw new Error(res.data?.message || "Failed to save expense.");
      setShowForm(false);
      setFeedback({ type: "success", text: res.data.message || "Expense saved." });
      fetchRows();
    } catch (err) {
      console.error("[ManageExpenses] Save error:", err);
      const e2 = err as { response?: { data?: { errors?: Record<string, string[]> } } };
      const apiErrors = e2?.response?.data?.errors;
      if (apiErrors) {
        const mapped: FormErrors = {};
        Object.entries(apiErrors).forEach(([key, msgs]) => {
          const field = key.startsWith("line_items") ? "line_items" : key;
          mapped[field as keyof FormErrors] = mapped[field as keyof FormErrors] || msgs[0];
        });
        setFormErrors(mapped);
      }
      alert(getApiErrorMessage(err, "Failed to save expense. Please check the form."));
    } finally {
      setSubmitting(false);
    }
  };

  const askForward = (ids: number[]) => {
    const total = rows
      .filter((r) => ids.includes(r.expense_id))
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);
    setConfirm({ kind: "forward", ids, total });
  };

  const forwardableRows = useMemo(() => filteredRows.filter(isEditable), [filteredRows]);

  const askForwardAll = () => {
    if (forwardableRows.length === 0) return;
    const ids = forwardableRows.map((r) => r.expense_id);
    const total = forwardableRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const counts = new Map<string, number>();
    forwardableRows.forEach((r) => counts.set(r.category_label, (counts.get(r.category_label) || 0) + 1));
    const breakdown = [...counts.entries()].map(([label, count]) => ({ label, count }));
    console.log("[ManageExpenses] Forward all", { ids, total, breakdown });
    setConfirm({ kind: "forward", ids, total, all: true, breakdown });
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      if (confirm.kind === "forward") {
        const res = await expenseAPI.forward(confirm.ids);
        if (!res.data?.success) throw new Error(res.data?.message);
        const skipped = res.data.data?.skipped_count || 0;
        setFeedback({
          type: "success",
          text:
            (res.data.message || "Expenses forwarded.") +
            (skipped > 0 ? ` ${skipped} could not be forwarded (already sent or verified).` : ""),
        });
        setSelectedIds((prev) => prev.filter((id) => !confirm.ids.includes(id)));
      } else {
        const res = await expenseAPI.remove(confirm.row.expense_id);
        if (!res.data?.success) throw new Error(res.data?.message);
        setFeedback({ type: "success", text: "Expense deleted." });
        setSelectedIds((prev) => prev.filter((id) => id !== confirm.row.expense_id));
      }
      setConfirm(null);
      fetchRows();
    } catch (err) {
      console.error("[ManageExpenses] Confirm action error:", err);
      setFeedback({
        type: "error",
        text: getApiErrorMessage(
          err,
          confirm.kind === "forward" ? "Failed to forward expenses." : "Failed to delete expense."
        ),
      });
      setConfirm(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const inputClass = (error?: string) =>
    `w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
      error ? "border-red-400" : "border-slate-200"
    }`;

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600 text-white">
            <Receipt size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Church Expenses</h1>
            <p className="text-sm text-slate-500 mt-1">
              Record parish expenses, then forward them to the cashier for verification
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={askForwardAll}
            disabled={loading || forwardableRows.length === 0}
            title={
              forwardableRows.length === 0
                ? "No draft or returned expenses to forward in the current filter"
                : "Forward every draft and returned expense in the current filter"
            }
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-50 disabled:opacity-50 disabled:hover:bg-white disabled:cursor-not-allowed"
          >
            <Send size={16} /> Forward all ({forwardableRows.length})
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading && !summary ? (
          Array.from({ length: 4 }).map((_, i) => <SecretaryStatSkeleton key={`exp-stat-${i}`} />)
        ) : (
          <>
            <SecretaryStatCard
              label="Draft"
              value={summary?.draft ?? 0}
              icon={FileText}
              highlight={statusFilter === "draft"}
              onClick={() => setStatusFilter(statusFilter === "draft" ? "all" : "draft")}
            />
            <SecretaryStatCard
              label="Awaiting Cashier"
              value={summary?.forwarded ?? 0}
              icon={Clock}
              highlight={statusFilter === "forwarded"}
              onClick={() => setStatusFilter(statusFilter === "forwarded" ? "all" : "forwarded")}
            />
            <SecretaryStatCard
              label="Verified this month"
              value={formatPeso(summary?.verified_this_month ?? 0)}
              icon={CheckCircle2}
            />
            <SecretaryStatCard
              label="Returned"
              value={summary?.returned ?? 0}
              icon={RotateCcw}
              highlight={statusFilter === "returned"}
              onClick={() => setStatusFilter(statusFilter === "returned" ? "all" : "returned")}
            />
          </>
        )}
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
        <label className="flex flex-col text-xs font-medium text-slate-600">
          Month
          <div className="flex items-center gap-1 mt-1">
            <input
              type="month"
              value={monthFilter}
              max={currentMonth()}
              onChange={(e) => {
                console.log("[ManageExpenses] Month filter:", e.target.value);
                setMonthFilter(e.target.value);
              }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            />
            {monthFilter && (
              <button
                type="button"
                onClick={() => setMonthFilter("")}
                className="px-2 py-2 text-xs text-slate-500 hover:text-slate-800"
                title="Show all months"
              >
                All
              </button>
            )}
          </div>
        </label>
        <label className="flex flex-col text-xs font-medium text-slate-600">
          Category
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
          >
            <option value="all">All categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs font-medium text-slate-600">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
          >
            <option value="all">All statuses</option>
            {(Object.keys(EXPENSE_STATUS_LABELS) as ExpenseStatus[]).map((s) => (
              <option key={s} value={s}>
                {EXPENSE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs font-medium text-slate-600 flex-1 min-w-[200px] max-w-xs">
          Search
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Description, payee, OR no..."
            className="mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </label>
        <button
          type="button"
          onClick={fetchRows}
          disabled={loading}
          className="px-4 py-2 bg-slate-100 rounded-lg text-sm disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {selectedIds.length > 0 && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm text-blue-900">
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
              onClick={() => askForward(selectedIds)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Send size={15} /> Forward selected to Cashier
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all forwardable expenses on this page"
                    checked={allPageSelected}
                    disabled={selectableOnPage.length === 0}
                    onChange={toggleSelectPage}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Description</th>
                <th className="text-left px-4 py-3">Paid to</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && rows.length === 0 ? (
                <SecretaryTableSkeleton columns={8} />
              ) : loadError ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <p className="text-sm text-red-600 mb-3">{loadError}</p>
                    <button
                      type="button"
                      onClick={fetchRows}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    <Wallet className="mx-auto mb-2 text-slate-300" size={32} />
                    {search.trim()
                      ? `No expenses matching "${search.trim()}"`
                      : monthFilter
                      ? `No expenses recorded for ${formatMonthLabel(monthFilter)}`
                      : "No expenses recorded yet"}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => {
                  const editable = isEditable(row);
                  return (
                    <tr key={row.expense_id} className={selectedIds.includes(row.expense_id) ? "bg-blue-50/50" : ""}>
                      <td className="px-4 py-3 align-top">
                        <input
                          type="checkbox"
                          aria-label={`Select expense ${row.description}`}
                          checked={selectedIds.includes(row.expense_id)}
                          disabled={!editable}
                          onChange={() => toggleSelect(row.expense_id)}
                          className="h-4 w-4 rounded border-slate-300 disabled:opacity-30"
                        />
                      </td>
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
                      <td className="px-4 py-3 align-top">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_STYLES[row.status]}`}>
                          {EXPENSE_STATUS_LABELS[row.status]}
                        </span>
                        {row.status === "returned" && row.return_reason && (
                          <p className="text-xs text-red-600 mt-1 max-w-[200px] flex gap-1">
                            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                            {row.return_reason}
                          </p>
                        )}
                        {row.status === "verified" && row.reviewed_by && (
                          <p className="text-xs text-slate-500 mt-1">by {row.reviewed_by}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {editable ? (
                          <div className="inline-flex gap-1.5 whitespace-nowrap justify-end w-full">
                            <button
                              type="button"
                              onClick={() => askForward([row.expense_id])}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
                            >
                              <Send size={13} /> Forward
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                            >
                              <Pencil size={13} /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirm({ kind: "delete", row })}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 rounded-lg hover:bg-red-100"
                              aria-label="Delete expense"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 text-right">Locked</p>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredRows.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 text-sm">
            <p className="text-slate-500">
              {filteredRows.length} expense(s) · Total <span className="font-semibold text-slate-800">{formatPeso(filteredTotal)}</span>
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

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-clear bg-opacity-20 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSubmit}
            className={`bg-white rounded-xl shadow-xl w-full max-h-[90vh] overflow-y-auto ${
              itemMode === "product" ? "max-w-3xl" : "max-w-2xl"
            }`}
            noValidate
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{editing ? "Edit Expense" : "Add Expense"}</h3>
                {editing?.status === "returned" && editing.return_reason && (
                  <p className="text-xs text-red-600 mt-1">Returned: {editing.return_reason}</p>
                )}
              </div>
              <ModalCloseButton onClick={() => setShowForm(false)} />
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label htmlFor="exp-category" className="text-sm font-medium text-slate-700">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  id="exp-category"
                  value={form.category}
                  onChange={(e) => {
                    const value = e.target.value as ExpenseCategory;
                    console.log("[ManageExpenses] Category selected:", value);
                    setForm({ ...form, category: value });
                    setFormErrors((prev) => ({ ...prev, category: undefined, payee_name: undefined, billing_period: undefined }));
                  }}
                  className={`${inputClass(formErrors.category)} bg-white`}
                >
                  <option value="">Select category…</option>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {categoryInfo && <p className="mt-1 text-xs text-slate-500">{categoryInfo.hint}</p>}
                {formErrors.category && <p className="mt-1 text-xs text-red-600">{formErrors.category}</p>}
              </div>

              <div>
                <label htmlFor="exp-description" className="text-sm font-medium text-slate-700">
                  Description <span className="text-red-500">*</span>
                </label>
                <input
                  id="exp-description"
                  value={form.description}
                  maxLength={255}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={categoryInfo ? `e.g. ${categoryInfo.hint}` : "What was this expense for?"}
                  className={inputClass(formErrors.description)}
                />
                {formErrors.description && <p className="mt-1 text-xs text-red-600">{formErrors.description}</p>}
              </div>

              {categoryInfo?.payeeLabel && (
                <div>
                  <label htmlFor="exp-payee" className="text-sm font-medium text-slate-700">
                    {categoryInfo.payeeLabel} {categoryInfo.payeeRequired && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    id="exp-payee"
                    value={form.payee_name}
                    maxLength={150}
                    onChange={(e) => setForm({ ...form, payee_name: e.target.value })}
                    className={inputClass(formErrors.payee_name)}
                  />
                  {formErrors.payee_name && <p className="mt-1 text-xs text-red-600">{formErrors.payee_name}</p>}
                </div>
              )}

              {isItemized && categoryInfo && (
                <ExpenseLineItemsEditor
                  config={categoryInfo.items}
                  rows={lineItems}
                  onChange={(next) => {
                    setLineItems(next);
                    if (Object.keys(lineItemErrors).length > 0 || formErrors.line_items) {
                      setLineItemErrors({});
                      setFormErrors((prev) => ({ ...prev, line_items: undefined }));
                    }
                  }}
                  rowErrors={lineItemErrors}
                  error={formErrors.line_items}
                />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {!isItemized && (
                  <div>
                    <label htmlFor="exp-amount" className="text-sm font-medium text-slate-700">
                      Amount (₱) <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1">
                      <PesoInput
                        id="exp-amount"
                        value={form.amount}
                        onChange={(raw) => setForm((prev) => ({ ...prev, amount: raw }))}
                        hasError={!!formErrors.amount}
                      />
                    </div>
                    {formErrors.amount && <p className="mt-1 text-xs text-red-600">{formErrors.amount}</p>}
                  </div>
                )}
                <div>
                  <label htmlFor="exp-date" className="text-sm font-medium text-slate-700">
                    Expense date <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="exp-date"
                    type="date"
                    value={form.expense_date}
                    max={todayLocal()}
                    onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                    className={inputClass(formErrors.expense_date)}
                  />
                  {formErrors.expense_date && <p className="mt-1 text-xs text-red-600">{formErrors.expense_date}</p>}
                </div>
              </div>

              {categoryInfo?.requiresBillingPeriod && (
                <div>
                  <label htmlFor="exp-billing" className="text-sm font-medium text-slate-700">
                    Billing month <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="exp-billing"
                    type="month"
                    value={form.billing_period}
                    onChange={(e) => setForm({ ...form, billing_period: e.target.value })}
                    className={inputClass(formErrors.billing_period)}
                  />
                  {formErrors.billing_period && <p className="mt-1 text-xs text-red-600">{formErrors.billing_period}</p>}
                </div>
              )}

              <div>
                <label htmlFor="exp-ref" className="text-sm font-medium text-slate-700">
                  OR / Receipt no.
                </label>
                <input
                  id="exp-ref"
                  value={form.reference_no}
                  maxLength={100}
                  onChange={(e) => setForm({ ...form, reference_no: e.target.value })}
                  placeholder="Optional"
                  className={inputClass()}
                />
              </div>

              <div>
                <label htmlFor="exp-notes" className="text-sm font-medium text-slate-700">
                  Notes
                </label>
                <textarea
                  id="exp-notes"
                  value={form.notes}
                  maxLength={500}
                  rows={2}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={inputClass()}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end px-6 pb-5">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 rounded-lg text-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {submitting ? "Saving..." : editing ? "Save Changes" : "Save as Draft"}
              </button>
            </div>
          </form>
        </div>
      )}

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

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-clear bg-opacity-20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" role="alertdialog" aria-modal="true">
            {confirm.kind === "forward" ? (
              <>
                <h3 className="text-lg font-bold text-slate-800 mb-2">
                  {confirm.all ? "Forward all to Cashier?" : "Forward to Cashier?"}
                </h3>
                <p className="text-sm text-slate-600 mb-1">
                  {confirm.all ? "All " : ""}
                  {confirm.ids.length} expense(s) totaling{" "}
                  <span className="font-semibold text-slate-900">{formatPeso(confirm.total)}</span> will be sent to the
                  cashier for verification.
                </p>
                {confirm.all && (
                  <p className="text-xs text-slate-500 mb-1">
                    {monthFilter ? formatMonthLabel(monthFilter) : "All months"}
                    {categoryFilter !== "all" ? ` · ${getExpenseCategory(categoryFilter)?.label}` : ""}
                    {search.trim() ? ` · matching "${search.trim()}"` : ""}
                  </p>
                )}
                {confirm.breakdown && confirm.breakdown.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 my-2">
                    {confirm.breakdown.map((b) => (
                      <span key={b.label} className="px-2 py-0.5 rounded-full bg-slate-100 text-xs text-slate-700">
                        {b.label} {b.count}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-500 mb-5">
                  Forwarded expenses are locked. If the cashier returns one, you can edit and forward it again.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Delete expense?</h3>
                <p className="text-sm text-slate-600 mb-5">
                  {confirm.row.category_label} · {confirm.row.description} · {formatPeso(confirm.row.amount)}. This
                  cannot be undone.
                </p>
              </>
            )}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                disabled={confirmBusy}
                className="px-4 py-2 bg-slate-100 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirmBusy}
                className={`px-4 py-2 text-white rounded-lg text-sm font-semibold disabled:opacity-50 ${
                  confirm.kind === "forward" ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {confirmBusy
                  ? "Please wait..."
                  : confirm.kind === "forward"
                  ? confirm.all
                    ? `Forward all (${confirm.ids.length})`
                    : "Forward"
                  : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageExpenses;
