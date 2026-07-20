import React, { useCallback, useEffect, useMemo, useState } from "react";
import { donationAPI, type DonationRow } from "../../../../library/cashier";
import {
  PHP_DENOMINATIONS,
  emptyDenominationRow,
  formatDenomination,
  recalcLine,
  sumDenominationLines,
  toPayloadBreakdown,
  type DenominationLine,
} from "../../../../library/denominations";
import { HandCoins, Plus, Trash2 } from "lucide-react";

const formatPeso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const typeLabel = (type?: string | null) =>
  type === "donation" ? "Donation" : "Love Offering";

const ManageDonations: React.FC = () => {
  const [rows, setRows] = useState<DonationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [form, setForm] = useState({
    donor_name: "",
    contribution_type: "donation" as "donation" | "love_offering",
    donation_date: todayLocal(),
    notes: "",
  });
  const [denomRows, setDenomRows] = useState<DenominationLine[]>([emptyDenominationRow()]);
  const [preview, setPreview] = useState<DonationRow | null>(null);

  const grandTotal = useMemo(() => sumDenominationLines(denomRows), [denomRows]);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      console.log("Secretary fetching donations...", { statusFilter, typeFilter });
      const res = await donationAPI.list({
        status: statusFilter === "all" ? undefined : statusFilter,
        contribution_type: typeFilter === "all" ? undefined : typeFilter,
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
  }, [statusFilter, typeFilter]);

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
      donor_name: "",
      contribution_type: "donation",
      donation_date: todayLocal(),
      notes: "",
    });
    setDenomRows([emptyDenominationRow()]);
  };

  const handleCreate = async () => {
    const breakdown = toPayloadBreakdown(denomRows);
    if (!form.contribution_type) {
      setFeedback("Select whether this is a Donation or a Love Offering.");
      return;
    }
    if (breakdown.length === 0 || !form.donation_date) {
      setFeedback("Add at least one denomination with a count, and set the date.");
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      console.log("Saving contribution:", {
        contribution_type: form.contribution_type,
        breakdown,
      });
      const res = await donationAPI.create({
        donor_name: form.donor_name || undefined,
        contribution_type: form.contribution_type,
        donation_date: form.donation_date,
        notes: form.notes || undefined,
        denomination_breakdown: breakdown,
      });
      if (res.data?.success) {
        setShowModal(false);
        resetForm();
        setFeedback(
          `${typeLabel(form.contribution_type)} recorded. Remit the cash to the cashier for approval.`
        );
        fetchRows();
      } else {
        setFeedback(res.data?.message || "Failed to record contribution.");
      }
    } catch (err: any) {
      console.error(err);
      setFeedback(err?.response?.data?.message || "Failed to record contribution.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-600 text-white">
            <HandCoins size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Donations</h1>
            <p className="text-sm text-slate-500 mt-1">
              Record Donation or Love Offering by denomination, then remit to the cashier
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
          Record Contribution
        </button>
      </div>

      {feedback && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-blue-50 text-blue-800 text-sm">{feedback}</div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending cashier</option>
          <option value="received">Received</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
        >
          <option value="all">All types</option>
          <option value="donation">Donation</option>
          <option value="love_offering">Love Offering</option>
        </select>
        <button onClick={fetchRows} className="px-4 py-2 bg-slate-100 rounded-lg text-sm">
          Refresh
        </button>
      </div>

      {loading && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-800">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent shrink-0" />
          Loading donations…
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3">Donor</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Cashier</th>
                <th className="text-left px-4 py-3">Notes</th>
                <th className="text-left px-4 py-3">Breakdown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    Fetching donations…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    No donations recorded yet
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.donation_id}>
                    <td className="px-4 py-3 font-medium">{row.donor_name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          row.contribution_type === "donation"
                            ? "bg-violet-100 text-violet-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {typeLabel(row.contribution_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatPeso(row.amount)}</td>
                    <td className="px-4 py-3">{row.donation_date}</td>
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
                        {row.status.toUpperCase()}
                      </span>
                      {row.reject_reason && (
                        <p className="text-xs text-red-600 mt-1">{row.reject_reason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{row.received_by || "—"}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-[220px] truncate">{row.notes || "—"}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setPreview(row)}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-clear bg-opacity-20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Record Cash Contribution</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Type *</label>
                <select
                  value={form.contribution_type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      contribution_type: e.target.value as "donation" | "love_offering",
                    })
                  }
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  <option value="donation">Donation</option>
                  <option value="love_offering">Love Offering</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Donation and Love Offering are separate categories on reports and the Cash Count Form.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Donor name</label>
                <input
                  value={form.donor_name}
                  onChange={(e) => setForm({ ...form, donor_name: e.target.value })}
                  placeholder="Anonymous if blank"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
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
                          <td className="px-3 py-2 font-semibold text-slate-800">
                            {Number(line.total || 0).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              disabled={denomRows.length === 1}
                              onClick={() => setDenomRows((prev) => prev.filter((_, i) => i !== index))}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded disabled:opacity-30"
                              title="Remove row"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 flex justify-between items-center text-sm">
                  <span className="text-slate-500">Grand total</span>
                  <span className="font-bold text-slate-900 text-base">{formatPeso(grandTotal)}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Date *</label>
                <input
                  type="date"
                  value={form.donation_date}
                  onChange={(e) => setForm({ ...form, donation_date: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
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
                {submitting ? "Saving..." : "Save"}
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
              {typeLabel(preview.contribution_type)} · {preview.donor_name} · {formatPeso(preview.amount)}
            </p>
            {(preview.denomination_breakdown || []).length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No breakdown recorded</p>
            ) : (
              <table className="w-full text-sm mb-4">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2">Denomination</th>
                    <th className="text-left px-3 py-2">Amount</th>
                    <th className="text-left px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.denomination_breakdown?.map((line, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{formatDenomination(line.denomination)}</td>
                      <td className="px-3 py-2">{line.count}</td>
                      <td className="px-3 py-2 font-semibold">{Number(line.total).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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

export default ManageDonations;
