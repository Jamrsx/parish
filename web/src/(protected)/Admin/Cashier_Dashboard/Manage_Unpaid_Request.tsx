import React, { useCallback, useEffect, useState } from "react";
import { cashierAPI, type UnpaidRequestRow } from "../../../../library/cashier";

const formatPeso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatRequestId = (requestId: number) => `REQ-${String(requestId).padStart(6, "0")}`;

const ManageUnpaidRequest: React.FC = () => {
  const [rows, setRows] = useState<UnpaidRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selected, setSelected] = useState<UnpaidRequestRow | null>(null);
  const [amount, setAmount] = useState("");
  const [orNumber, setOrNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      console.log("Fetching unpaid requests...", { search, paymentFilter });
      const res = await cashierAPI.unpaidRequests({
        search: search || undefined,
        payment_status: paymentFilter === "all" ? undefined : paymentFilter,
        per_page: 50,
      });
      if (res.data?.success) {
        const data = res.data.data;
        setRows(Array.isArray(data) ? data : data?.data || []);
      }
    } catch (err) {
      console.error("Unpaid requests error:", err);
    } finally {
      setLoading(false);
    }
  }, [search, paymentFilter]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const openPay = (row: UnpaidRequestRow) => {
    setSelected(row);
    setAmount(String(row.remaining_balance || ""));
    setOrNumber("");
    setNotes("");
  };

  const submitPayment = async () => {
    if (!selected) return;
    const value = Number(amount);
    if (!value || value <= 0) {
      setFeedback("Enter a valid cash amount.");
      return;
    }
    if (value > selected.remaining_balance) {
      setFeedback("Amount exceeds remaining balance.");
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      console.log("Recording cash payment:", selected.request_id, value);
      const res = await cashierAPI.recordPayment(selected.request_id, {
        amount: value,
        or_number: orNumber || undefined,
        notes: notes || undefined,
      });
      if (res.data?.success) {
        setFeedback(res.data.message || "Payment recorded.");
        setSelected(null);
        fetchRows();
      } else {
        setFeedback(res.data?.message || "Failed to record payment.");
      }
    } catch (err: any) {
      console.error("Pay error:", err);
      setFeedback(err?.response?.data?.message || "Failed to record payment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Collect Payments</h1>
        <p className="text-sm text-slate-500 mt-1">Cash only — record payments for booked services</p>
      </div>

      {feedback && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-emerald-50 text-emerald-800 text-sm">{feedback}</div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search request ID, parishioner, or service..."
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
        />
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
        >
          <option value="all">All unpaid / partial</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
        </select>
        <button onClick={fetchRows} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">
          Refresh
        </button>
      </div>

      {loading && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-sm text-emerald-800">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-600 border-t-transparent shrink-0" />
          Loading unpaid requests…
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3">Request ID</th>
                <th className="text-left px-4 py-3">Parishioner</th>
                <th className="text-left px-4 py-3">Service</th>
                <th className="text-left px-4 py-3">Schedule</th>
                <th className="text-left px-4 py-3">Fee</th>
                <th className="text-left px-4 py-3">Paid</th>
                <th className="text-left px-4 py-3">Balance</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    Fetching unpaid requests…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-500">
                    No requests awaiting payment
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.request_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                        {formatRequestId(row.request_id)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{row.user?.full_name || "N/A"}</td>
                    <td className="px-4 py-3">{row.service?.service_type || row.form_summary}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {row.preferred_date} {row.preferred_time || ""}
                    </td>
                    <td className="px-4 py-3">{formatPeso(row.service?.fee || 0)}</td>
                    <td className="px-4 py-3">{formatPeso(row.amount_paid)}</td>
                    <td className="px-4 py-3 font-semibold text-amber-700">{formatPeso(row.remaining_balance)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          row.payment_status === "partial"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {row.payment_status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openPay(row)}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700"
                      >
                        Record Cash
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 bg-opacity-20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Record Cash Payment</h3>
            <p className="text-sm text-slate-500 mb-1">
              {selected.user?.full_name} · {selected.service?.service_type}
            </p>
            <p className="text-xs font-mono font-semibold text-emerald-700 mb-4">
              Request {formatRequestId(selected.request_id)}
            </p>
            <div className="space-y-3 text-sm mb-4 bg-slate-50 rounded-lg p-3">
              <div className="flex justify-between">
                <span>Service fee</span>
                <span className="font-medium">{formatPeso(selected.service?.fee || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Already paid</span>
                <span className="font-medium">{formatPeso(selected.amount_paid)}</span>
              </div>
              <div className="flex justify-between">
                <span>Balance</span>
                <span className="font-semibold text-amber-700">{formatPeso(selected.remaining_balance)}</span>
              </div>
            </div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cash amount *</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg mb-3"
            />
            <label className="block text-sm font-medium text-slate-700 mb-1">OR / Receipt no. (optional)</label>
            <input
              value={orNumber}
              onChange={(e) => setOrNumber(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg mb-3"
            />
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setSelected(null)}
                disabled={submitting}
                className="px-4 py-2 bg-slate-100 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={submitPayment}
                disabled={submitting}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Confirm Cash Received"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageUnpaidRequest;
