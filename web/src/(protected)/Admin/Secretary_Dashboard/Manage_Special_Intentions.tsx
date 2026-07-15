import React, { useCallback, useEffect, useMemo, useState } from "react";
import { specialIntentionAPI, type SpecialIntentionRow } from "../../../../library/cashier";
import {
  PHP_DENOMINATIONS,
  emptyDenominationRow,
  formatDenomination,
  recalcLine,
  sumDenominationLines,
  toPayloadBreakdown,
  type DenominationLine,
} from "../../../../library/denominations";
import { BookOpen, Plus, Trash2 } from "lucide-react";

const formatPeso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const statusBadge = (status: SpecialIntentionRow["status"]) => {
  switch (status) {
    case "pending":
      return { label: "AWAITING SECRETARY", className: "bg-amber-100 text-amber-800" };
    case "approved":
      return { label: "READY FOR CASHIER", className: "bg-blue-100 text-blue-800" };
    case "received":
      return { label: "RECEIVED", className: "bg-emerald-100 text-emerald-800" };
    case "rejected":
      return { label: "REJECTED", className: "bg-red-100 text-red-700" };
    default:
      return { label: String(status).toUpperCase(), className: "bg-slate-100 text-slate-700" };
  }
};

const ManageSpecialIntentions: React.FC = () => {
  const [rows, setRows] = useState<SpecialIntentionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [preview, setPreview] = useState<SpecialIntentionRow | null>(null);
  const [rejectRow, setRejectRow] = useState<SpecialIntentionRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<SpecialIntentionRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [form, setForm] = useState({
    parishioner_name: "",
    intention_text: "",
    intention_date: todayLocal(),
    notes: "",
  });
  const [denomRows, setDenomRows] = useState<DenominationLine[]>([emptyDenominationRow()]);

  const grandTotal = useMemo(() => sumDenominationLines(denomRows), [denomRows]);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      console.log("Secretary fetching special intentions...", statusFilter);
      const res = await specialIntentionAPI.list({
        status: statusFilter === "all" ? undefined : statusFilter,
        per_page: 50,
      });
      if (res.data?.success) {
        const data = res.data.data;
        setRows(Array.isArray(data) ? data : data?.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const updateDenomRow = (index: number, patch: Partial<DenominationLine>) => {
    setDenomRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? recalcLine({
              denomination: patch.denomination ?? row.denomination,
              count: patch.count ?? row.count,
            })
          : row
      )
    );
  };

  const resetForm = () => {
    setForm({
      parishioner_name: "",
      intention_text: "",
      intention_date: todayLocal(),
      notes: "",
    });
    setDenomRows([emptyDenominationRow()]);
  };

  const handleCreate = async () => {
    const breakdown = toPayloadBreakdown(denomRows);
    if (!form.parishioner_name.trim() || form.intention_text.trim().length < 5 || !form.intention_date || breakdown.length === 0) {
      setFeedback("Name, intention (min 5 chars), date, and at least one denomination are required.");
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      console.log("Saving special intention:", form, breakdown);
      const res = await specialIntentionAPI.create({
        parishioner_name: form.parishioner_name.trim(),
        intention_text: form.intention_text.trim(),
        intention_date: form.intention_date,
        notes: form.notes || undefined,
        denomination_breakdown: breakdown,
      });
      if (res.data?.success) {
        setShowModal(false);
        resetForm();
        setFeedback("Special intention recorded. Remit cash to the cashier for confirmation.");
        fetchRows();
      } else {
        setFeedback(res.data?.message || "Failed to save.");
      }
    } catch (err: any) {
      console.error(err);
      setFeedback(err?.response?.data?.message || "Failed to save special intention.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSecretaryApprove = async (id: number) => {
    setBusyId(id);
    setFeedback(null);
    try {
      console.log("Secretary approving special intention:", id);
      const res = await specialIntentionAPI.secretaryApprove(id);
      if (res.data?.success) {
        setFeedback("Approved. This intention is now visible to the cashier.");
        fetchRows();
      } else {
        setFeedback(res.data?.message || "Failed to approve.");
      }
    } catch (err: any) {
      console.error(err);
      setFeedback(err?.response?.data?.message || "Failed to approve.");
    } finally {
      setBusyId(null);
    }
  };

  const handleSecretaryReject = async () => {
    if (!rejectRow || rejectReason.trim().length < 5) {
      setFeedback("Rejection reason must be at least 5 characters.");
      return;
    }
    setBusyId(rejectRow.intention_id);
    try {
      console.log("Secretary rejecting special intention:", rejectRow.intention_id);
      const res = await specialIntentionAPI.secretaryReject(rejectRow.intention_id, rejectReason.trim());
      if (res.data?.success) {
        setFeedback("Special intention request rejected.");
        setRejectRow(null);
        setRejectReason("");
        fetchRows();
      } else {
        setFeedback(res.data?.message || "Failed to reject.");
      }
    } catch (err: any) {
      console.error(err);
      setFeedback(err?.response?.data?.message || "Failed to reject.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteRow) return;
    const id = deleteRow.intention_id;
    setBusyId(id);
    setFeedback(null);
    try {
      console.log("Deleting special intention:", id);
      await specialIntentionAPI.remove(id);
      setDeleteRow(null);
      setFeedback("Special intention deleted.");
      fetchRows();
    } catch (err: any) {
      console.error(err);
      setFeedback(err?.response?.data?.message || "Failed to delete.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-violet-600 text-white">
            <BookOpen size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Special Intentions</h1>
            <p className="text-sm text-slate-500 mt-1">
              Approve mobile app requests, or record walk-in intentions for the cashier
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold"
        >
          Record Intention
        </button>
      </div>

      {feedback && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-blue-50 text-blue-800 text-sm">{feedback}</div>
      )}

      <div className="flex gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
        >
          <option value="all">All</option>
          <option value="pending">Awaiting secretary</option>
          <option value="approved">Ready for cashier</option>
          <option value="received">Received</option>
          <option value="rejected">Rejected</option>
        </select>
        <button onClick={fetchRows} className="px-4 py-2 bg-slate-100 rounded-lg text-sm">
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-slate-500">No special intentions in this filter</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3">Parishioner</th>
                  <th className="text-left px-4 py-3">Intention</th>
                  <th className="text-left px-4 py-3">Amount</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Details</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const badge = statusBadge(row.status);
                  return (
                    <tr key={row.intention_id}>
                      <td className="px-4 py-3 font-medium">
                        {row.parishioner_name}
                        {row.source === "parishioner" && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">
                            APP
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[280px]">
                        <p className="line-clamp-2">{row.intention_text}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold">{formatPeso(row.amount)}</td>
                      <td className="px-4 py-3">{row.intention_date}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge.className}`}>
                          {badge.label}
                        </span>
                        {row.reject_reason && (
                          <p className="text-xs text-red-600 mt-1">{row.reject_reason}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setPreview(row)}
                          className="text-xs font-semibold text-blue-600 hover:underline"
                        >
                          View
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {row.status === "pending" && (
                            <>
                              <button
                                onClick={() => handleSecretaryApprove(row.intention_id)}
                                disabled={busyId === row.intention_id}
                                className="text-xs font-semibold text-emerald-700 disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setRejectRow(row);
                                  setRejectReason("");
                                }}
                                className="text-xs font-semibold text-rose-600"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {(row.status === "pending" || row.status === "approved") && (
                            <button
                              onClick={() => {
                                console.log("Open delete confirm for special intention:", row.intention_id);
                                setDeleteRow(row);
                              }}
                              className="text-xs font-semibold text-slate-500"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-clear bg-opacity-20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Record Special Intention</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Parishioner name *</label>
                <input
                  value={form.parishioner_name}
                  onChange={(e) => setForm({ ...form, parishioner_name: e.target.value })}
                  placeholder="e.g. Althian James"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Intention *</label>
                <textarea
                  value={form.intention_text}
                  onChange={(e) => setForm({ ...form, intention_text: e.target.value })}
                  rows={3}
                  placeholder="e.g. I want to be blessed by the church to pass the bar exam"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Date *</label>
                <input
                  type="date"
                  value={form.intention_date}
                  onChange={(e) => setForm({ ...form, intention_date: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Offering (cash denominations) *</label>
                  <button
                    type="button"
                    onClick={() => setDenomRows((prev) => [...prev, emptyDenominationRow()])}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600"
                  >
                    <Plus size={14} /> Add row
                  </button>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Denomination</th>
                        <th className="text-left px-3 py-2 font-medium">Amount</th>
                        <th className="text-left px-3 py-2 font-medium">Total</th>
                        <th className="px-3 py-2 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {denomRows.map((line, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2">
                            <select
                              value={line.denomination}
                              onChange={(e) => updateDenomRow(index, { denomination: Number(e.target.value) })}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-sm bg-white"
                            >
                              {PHP_DENOMINATIONS.map((d) => (
                                <option key={d} value={d}>
                                  {formatDenomination(d)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={line.count || ""}
                              onChange={(e) => updateDenomRow(index, { count: Number(e.target.value) })}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-sm"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-2 font-semibold">{Number(line.total || 0).toLocaleString()}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              disabled={denomRows.length === 1}
                              onClick={() => setDenomRows((prev) => prev.filter((_, i) => i !== index))}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded disabled:opacity-30"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-slate-500">Grand total</span>
                  <span className="font-bold text-slate-900">{formatPeso(grandTotal)}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-100 rounded-lg text-sm">
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting || grandTotal <= 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Intention"}
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-clear bg-opacity-20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-1">{preview.parishioner_name}</h3>
            <p className="text-sm text-slate-600 mb-2">{preview.intention_text}</p>
            <p className="text-sm text-slate-500 mb-1">Date: {preview.intention_date}</p>
            <p className="text-sm font-semibold text-emerald-700 mb-3">{formatPeso(preview.amount)}</p>
            {(preview.denomination_breakdown || []).length > 0 ? (
              <table className="w-full text-sm mb-4">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2">Denomination</th>
                    <th className="text-left px-3 py-2">Amount</th>
                    <th className="text-left px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(preview.denomination_breakdown || []).map((line, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{formatDenomination(line.denomination)}</td>
                      <td className="px-3 py-2">{line.count}</td>
                      <td className="px-3 py-2 font-semibold">{Number(line.total).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-500 mb-4">No denomination breakdown (mobile app request).</p>
            )}
            <div className="flex justify-end">
              <button onClick={() => setPreview(null)} className="px-4 py-2 bg-slate-100 rounded-lg text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-clear bg-opacity-20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Reject Special Intention</h3>
            <p className="text-sm text-slate-600 mb-3">{rejectRow.parishioner_name}</p>
            <label className="text-sm font-medium text-slate-700">Reason *</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="Explain why this request is rejected"
            />
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => {
                  setRejectRow(null);
                  setRejectReason("");
                }}
                className="px-4 py-2 bg-slate-100 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSecretaryReject}
                disabled={busyId === rejectRow.intention_id}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {busyId === rejectRow.intention_id ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-clear bg-opacity-20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Special Intention</h3>
            <p className="text-sm text-slate-600 mb-1">
              Are you sure you want to delete this special intention? This cannot be undone.
            </p>
            <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm">
              <p className="font-semibold text-slate-800">{deleteRow.parishioner_name}</p>
              <p className="text-slate-600 line-clamp-2 mt-0.5">{deleteRow.intention_text}</p>
              <p className="text-slate-500 mt-1">{formatPeso(deleteRow.amount)}</p>
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <button
                onClick={() => setDeleteRow(null)}
                disabled={busyId === deleteRow.intention_id}
                className="px-4 py-2 bg-slate-100 rounded-lg text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={busyId === deleteRow.intention_id}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {busyId === deleteRow.intention_id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageSpecialIntentions;
