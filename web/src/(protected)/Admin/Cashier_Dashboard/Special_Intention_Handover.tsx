import React, { useCallback, useEffect, useState } from "react";
import { specialIntentionAPI, type SpecialIntentionRow } from "../../../../library/cashier";
import { formatDenomination } from "../../../../library/denominations";

const formatPeso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  onChanged?: () => void;
}

const SpecialIntentionHandover: React.FC<Props> = ({ onChanged }) => {
  const [rows, setRows] = useState<SpecialIntentionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("approved");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [review, setReview] = useState<SpecialIntentionRow | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      console.log("Cashier fetching special intentions...", statusFilter);
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

  const isAnyAmount = (row: SpecialIntentionRow) =>
    Boolean(row.any_amount) || Number(row.min_offering ?? row.amount) === 0;

  const openReview = (row: SpecialIntentionRow) => {
    setReview(row);
    setRejectMode(false);
    setRejectReason("");
    // Prefill: expected amount, or blank/0 for any-amount so cashier enters what was paid
    if (isAnyAmount(row) && row.source === "parishioner") {
      setAmountReceived("0");
    } else {
      setAmountReceived(String(row.amount ?? 0));
    }
  };

  const closeReview = () => {
    setReview(null);
    setRejectMode(false);
    setRejectReason("");
    setAmountReceived("");
  };

  const approve = async (id: number) => {
    if (!review) return;

    const value = Number(amountReceived);
    if (Number.isNaN(value) || value < 0) {
      setFeedback("Enter a valid amount received (0 or more).");
      return;
    }

    setBusyId(id);
    setFeedback(null);
    try {
      console.log("Cashier confirming special intention:", id, "amount:", value);
      const res = await specialIntentionAPI.approve(id, { amount: value });
      if (res.data?.success) {
        setFeedback(res.data.message || "Special intention offering confirmed.");
        closeReview();
        fetchRows();
        onChanged?.();
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

  const reject = async () => {
    if (!review || rejectReason.trim().length < 5) {
      setFeedback("Describe the discrepancy (at least 5 characters).");
      return;
    }
    setBusyId(review.intention_id);
    try {
      const res = await specialIntentionAPI.reject(review.intention_id, rejectReason.trim());
      if (res.data?.success) {
        setFeedback("Special intention declined due to discrepancy.");
        closeReview();
        fetchRows();
        onChanged?.();
      }
    } catch (err: any) {
      console.error(err);
      setFeedback(err?.response?.data?.message || "Failed to decline.");
    } finally {
      setBusyId(null);
    }
  };

  const amountLabel = (row: SpecialIntentionRow) => {
    if (row.status === "received") return formatPeso(row.amount);
    if (isAnyAmount(row)) return "Any amount";
    return formatPeso(row.amount);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Special Intention Handovers</h1>
        <p className="text-sm text-slate-500 mt-1">
          Confirm cash for special intentions already approved by the secretary. Fee ₱0 means any
          amount (including none).
        </p>
      </div>

      {feedback && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-emerald-50 text-emerald-800 text-sm">{feedback}</div>
      )}

      <div className="flex gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
        >
          <option value="approved">Awaiting cash confirm</option>
          <option value="received">Received</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
        <button onClick={fetchRows} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
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
                  <th className="text-left px-4 py-3">Recorded by</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.intention_id}>
                    <td className="px-4 py-3 font-medium">
                      {row.parishioner_name}
                      {row.source === "parishioner" && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">
                          APP
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[260px]">
                      <p className="line-clamp-2">{row.intention_text}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">{amountLabel(row)}</td>
                    <td className="px-4 py-3">{row.recorded_by || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          row.status === "approved"
                            ? "bg-amber-100 text-amber-800"
                            : row.status === "received"
                            ? "bg-emerald-100 text-emerald-800"
                            : row.status === "pending"
                            ? "bg-slate-100 text-slate-600"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {row.status === "approved"
                          ? "AWAITING CASH"
                          : row.status === "pending"
                          ? "AWAITING SECRETARY"
                          : row.status.toUpperCase()}
                      </span>
                      {row.reject_reason && (
                        <p className="text-xs text-red-600 mt-1 max-w-[180px]">{row.reject_reason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openReview(row)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          row.status === "approved"
                            ? "bg-emerald-600 text-white"
                            : "text-emerald-700 hover:underline bg-transparent px-0"
                        }`}
                      >
                        {row.status === "approved" ? "Review Cash" : "View"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {review && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 bg-opacity-20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Special Intention Preview</h3>
            <p className="text-base font-semibold text-slate-900 mt-2">{review.parishioner_name}</p>
            {review.source === "parishioner" && (
              <p className="text-xs font-semibold text-blue-700 mt-1">Submitted via mobile app</p>
            )}
            <p className="text-sm text-slate-600 mt-2 mb-3 whitespace-pre-wrap">{review.intention_text}</p>
            <p className="text-sm text-slate-500 mb-1">Date: {review.intention_date}</p>
            <p className="text-sm text-slate-500 mb-1">
              {review.source === "parishioner"
                ? "Requested by parishioner"
                : `Recorded by ${review.recorded_by || "Secretary"}`}
            </p>
            <p className="text-base font-bold text-emerald-700 mb-4">
              {isAnyAmount(review)
                ? "Configured offering: Any amount"
                : review.source === "parishioner"
                ? `Minimum offering: ${formatPeso(review.amount)}`
                : `Expected total: ${formatPeso(review.amount)}`}
            </p>

            {(review.denomination_breakdown || []).length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">
                {isAnyAmount(review)
                  ? "Enter the cash amount the parishioner paid. Use 0 if they paid nothing — you can still confirm."
                  : review.source === "parishioner"
                  ? "Collect the minimum cash offering from the parishioner, then confirm."
                  : "No denomination breakdown on this record."}
              </p>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left px-3 py-2">Denomination</th>
                      <th className="text-left px-3 py-2">Amount</th>
                      <th className="text-left px-3 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {review.denomination_breakdown?.map((line, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-medium">{formatDenomination(line.denomination)}</td>
                        <td className="px-3 py-2">{line.count}</td>
                        <td className="px-3 py-2 font-semibold">{Number(line.total).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {review.status === "approved" && !rejectMode && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Amount received (₱) {isAnyAmount(review) ? "— 0 allowed" : "*"}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="0.00"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Enter what the parishioner actually paid. Confirm even if the amount is ₱0.
                </p>
              </div>
            )}

            {rejectMode && (
              <div className="mb-4">
                <label className="text-sm font-medium text-slate-700">Discrepancy reason *</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="e.g. Cash counted does not match recorded total"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-3 justify-end">
              <button onClick={closeReview} className="px-4 py-2 bg-slate-100 rounded-lg text-sm">
                Close
              </button>
              {review.status === "approved" && !rejectMode && (
                <>
                  <button
                    onClick={() => setRejectMode(true)}
                    className="px-4 py-2 bg-rose-100 text-rose-700 rounded-lg text-sm font-semibold"
                  >
                    Decline (Discrepancy)
                  </button>
                  <button
                    onClick={() => approve(review.intention_id)}
                    disabled={busyId === review.intention_id}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                  >
                    {busyId === review.intention_id ? "Confirming..." : "Confirm Received"}
                  </button>
                </>
              )}
              {review.status === "approved" && rejectMode && (
                <button
                  onClick={reject}
                  disabled={busyId === review.intention_id}
                  className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {busyId === review.intention_id ? "Declining..." : "Confirm Decline"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpecialIntentionHandover;
