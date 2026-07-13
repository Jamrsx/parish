import React, { useCallback, useEffect, useMemo, useState } from "react";
import { massCollectionAPI, type MassCollectionRow } from "../../../../library/cashier";
import {
  PHP_DENOMINATIONS,
  emptyDenominationRow,
  formatDenomination,
  recalcLine,
  sumDenominationLines,
  toPayloadBreakdown,
  type DenominationLine,
} from "../../../../library/denominations";
import { Church, Plus, Trash2 } from "lucide-react";

const formatPeso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const ManageMassCollections: React.FC = () => {
  const [rows, setRows] = useState<MassCollectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [preview, setPreview] = useState<MassCollectionRow | null>(null);
  const [form, setForm] = useState({
    mass_date: todayLocal(),
    mass_type: "Sunday Mass",
    mass_time: "",
    notes: "",
  });
  const [denomRows, setDenomRows] = useState<DenominationLine[]>([emptyDenominationRow()]);

  const grandTotal = useMemo(() => sumDenominationLines(denomRows), [denomRows]);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      console.log("Secretary fetching mass collections...");
      const res = await massCollectionAPI.list({
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
    setForm({ mass_date: todayLocal(), mass_type: "Sunday Mass", mass_time: "", notes: "" });
    setDenomRows([emptyDenominationRow()]);
  };

  const handleCreate = async () => {
    const breakdown = toPayloadBreakdown(denomRows);
    if (!form.mass_date || !form.mass_type || breakdown.length === 0) {
      setFeedback("Mass date, type, and at least one denomination are required.");
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      console.log("Saving mass collection:", form, breakdown);
      const res = await massCollectionAPI.create({
        mass_date: form.mass_date,
        mass_type: form.mass_type,
        mass_time: form.mass_time || undefined,
        notes: form.notes || undefined,
        denomination_breakdown: breakdown,
      });
      if (res.data?.success) {
        setShowModal(false);
        resetForm();
        setFeedback("Mass collection recorded. Remit cash to the cashier for approval.");
        fetchRows();
      } else {
        setFeedback(res.data?.message || "Failed to save.");
      }
    } catch (err: any) {
      console.error(err);
      setFeedback(err?.response?.data?.message || "Failed to save mass collection.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this pending mass collection?")) return;
    try {
      await massCollectionAPI.remove(id);
      fetchRows();
    } catch (err: any) {
      console.error(err);
      setFeedback(err?.response?.data?.message || "Failed to delete.");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600 text-white">
            <Church size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Mass Collections</h1>
            <p className="text-sm text-slate-500 mt-1">
              Record mass cash by denomination, then remit to the cashier for confirmation
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
          Record Collection
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
          <option value="pending">Pending cashier</option>
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
          <p className="py-16 text-center text-slate-500">No mass collections yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Mass</th>
                  <th className="text-left px-4 py-3">Amount</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Cashier</th>
                  <th className="text-left px-4 py-3">Breakdown</th>
                  <th className="text-left px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.collection_id}>
                    <td className="px-4 py-3">
                      {row.mass_date}
                      {row.mass_time ? ` · ${row.mass_time}` : ""}
                    </td>
                    <td className="px-4 py-3 font-medium">{row.mass_type}</td>
                    <td className="px-4 py-3 font-semibold">{formatPeso(row.amount)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          row.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : row.status === "received"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {(row.status || "pending").toUpperCase()}
                      </span>
                      {row.reject_reason && (
                        <p className="text-xs text-red-600 mt-1">{row.reject_reason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{row.received_by || "—"}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setPreview(row)}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        View
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {row.status === "pending" && (
                        <button
                          onClick={() => handleDelete(row.collection_id)}
                          className="text-xs font-semibold text-red-600"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-clear bg-opacity-20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Record Mass Collection</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Mass date *</label>
                  <input
                    type="date"
                    value={form.mass_date}
                    onChange={(e) => setForm({ ...form, mass_date: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Time (optional)</label>
                  <input
                    type="time"
                    value={form.mass_time}
                    onChange={(e) => setForm({ ...form, mass_time: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Mass type *</label>
                <input
                  value={form.mass_type}
                  onChange={(e) => setForm({ ...form, mass_type: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="Sunday Mass"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Cash denominations *</label>
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
                {submitting ? "Saving..." : "Save Collection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-clear bg-opacity-20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Denomination Preview</h3>
            <p className="text-sm text-slate-500 mb-4">
              {preview.mass_type} · {formatPeso(preview.amount)}
            </p>
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
            <div className="flex justify-end">
              <button onClick={() => setPreview(null)} className="px-4 py-2 bg-slate-100 rounded-lg text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageMassCollections;
