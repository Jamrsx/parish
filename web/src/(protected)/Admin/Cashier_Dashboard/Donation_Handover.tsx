import React, { useCallback, useEffect, useState } from "react";
import { donationAPI, type DonationRow } from "../../../../library/cashier";
import { formatDenomination } from "../../../../library/denominations";

const formatPeso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  onChanged?: () => void;
}

const DonationHandover: React.FC<Props> = ({ onChanged }) => {
  const [rows, setRows] = useState<DonationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [review, setReview] = useState<DonationRow | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      console.log("Fetching donations for cashier...", statusFilter);
      const res = await donationAPI.list({
        status: statusFilter === "all" ? undefined : statusFilter,
        per_page: 50,
      });
      if (res.data?.success) {
        const data = res.data.data;
        setRows(Array.isArray(data) ? data : data?.data || []);
      }
    } catch (err) {
      console.error("Donations list error:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const closeReview = () => {
    setReview(null);
    setRejectMode(false);
    setRejectReason("");
  };

  const approve = async (id: number) => {
    setBusyId(id);
    setFeedback(null);
    try {
      console.log("Cashier confirming donation:", id);
      const res = await donationAPI.approve(id);
      if (res.data?.success) {
        setFeedback("Donation received and confirmed.");
        closeReview();
        fetchRows();
        onChanged?.();
      } else {
        setFeedback(res.data?.message || "Failed to approve.");
      }
    } catch (err: any) {
      console.error(err);
      setFeedback(err?.response?.data?.message || "Failed to approve donation.");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async () => {
    if (!review || rejectReason.trim().length < 5) {
      setFeedback("Describe the discrepancy (at least 5 characters).");
      return;
    }
    setBusyId(review.donation_id);
    try {
      console.log("Cashier declining donation for discrepancy:", review.donation_id);
      const res = await donationAPI.reject(review.donation_id, rejectReason.trim());
      if (res.data?.success) {
        setFeedback("Donation declined due to discrepancy.");
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Donation Handovers</h1>
        <p className="text-sm text-slate-500 mt-1">
          Preview denomination breakdown, then confirm if cash matches or decline if there is a discrepancy
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
          <option value="pending">Pending</option>
          <option value="received">Received</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
        <button onClick={fetchRows} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">
          Refresh
        </button>
      </div>

      {loading && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-sm text-emerald-800">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-600 border-t-transparent shrink-0" />
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
                <th className="text-left px-4 py-3">Donation date</th>
                <th className="text-left px-4 py-3">Recorded by</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    Fetching donations…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    No donations in this filter
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
                        {row.contribution_type === "donation" ? "Donation" : "Love Offering"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">{formatPeso(row.amount)}</td>
                    <td className="px-4 py-3">{row.donation_date}</td>
                    <td className="px-4 py-3">{row.recorded_by || "—"}</td>
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
                        <p className="text-xs text-red-600 mt-1 max-w-[200px]">{row.reject_reason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.status === "pending" ? (
                        <button
                          onClick={() => {
                            setReview(row);
                            setRejectMode(false);
                            setRejectReason("");
                          }}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold"
                        >
                          Review Cash
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setReview(row);
                            setRejectMode(false);
                          }}
                          className="text-xs font-semibold text-emerald-700 hover:underline"
                        >
                          View breakdown
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {review && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-clear bg-opacity-20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Cash Denomination Preview</h3>
            <p className="text-sm text-slate-500 mb-1">
              {review.contribution_type === "donation" ? "Donation" : "Love Offering"} ·{" "}
              {review.donor_name} · Recorded by {review.recorded_by || "Secretary"}
            </p>
            <p className="text-base font-bold text-emerald-700 mb-4">
              Expected total: {formatPeso(review.amount)}
            </p>

            {(review.denomination_breakdown || []).length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">
                No denomination breakdown on this record. Confirm the total amount only.
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

            {review.notes && (
              <p className="text-sm text-slate-600 mb-4">
                <span className="font-medium">Notes:</span> {review.notes}
              </p>
            )}

            {rejectMode && (
              <div className="mb-4">
                <label className="text-sm font-medium text-slate-700">Discrepancy reason *</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="e.g. Counted P3,500 only — missing one P500 bill"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-3 justify-end">
              <button onClick={closeReview} className="px-4 py-2 bg-slate-100 rounded-lg text-sm">
                Close
              </button>

              {review.status === "pending" && !rejectMode && (
                <>
                  <button
                    onClick={() => setRejectMode(true)}
                    className="px-4 py-2 bg-rose-100 text-rose-700 rounded-lg text-sm font-semibold"
                  >
                    Decline (Discrepancy)
                  </button>
                  <button
                    onClick={() => approve(review.donation_id)}
                    disabled={busyId === review.donation_id}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                  >
                    {busyId === review.donation_id ? "Confirming..." : "Confirm Match"}
                  </button>
                </>
              )}

              {review.status === "pending" && rejectMode && (
                <button
                  onClick={reject}
                  disabled={busyId === review.donation_id}
                  className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {busyId === review.donation_id ? "Declining..." : "Confirm Decline"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DonationHandover;
