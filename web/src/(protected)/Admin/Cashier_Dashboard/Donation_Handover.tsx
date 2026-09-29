import React, { useCallback, useEffect, useMemo, useState } from "react";
import { donationAPI, type DonationRow } from "../../../../library/cashier";
import { formatDenomination } from "../../../../library/denominations";
import { CashierTableSkeleton } from "./CashierSkeletons";

const formatPeso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type DonationStatus = "pending" | "received" | "rejected";
type StatusFilter = "all" | DonationStatus;

const STATUS_SECTIONS: {
  key: DonationStatus;
  label: string;
  description: string;
  empty: string;
  dot: string;
  badge: string;
}[] = [
  {
    key: "pending",
    label: "Pending",
    description: "Awaiting cash confirmation",
    empty: "No pending donations",
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-800",
  },
  {
    key: "received",
    label: "Received",
    description: "Cash confirmed by the cashier",
    empty: "No received donations",
    dot: "bg-blue-500",
    badge: "bg-blue-100 text-blue-800",
  },
  {
    key: "rejected",
    label: "Rejected",
    description: "Declined due to a discrepancy",
    empty: "No rejected donations",
    dot: "bg-red-500",
    badge: "bg-red-100 text-red-700",
  },
];

const apiErrorMessage = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const FETCH_LIMIT = 500;
const TABLE_COLUMNS = 7;

interface Props {
  onChanged?: () => void;
}

const DonationHandover: React.FC<Props> = ({ onChanged }) => {
  const [rows, setRows] = useState<DonationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [review, setReview] = useState<DonationRow | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await donationAPI.list({ per_page: FETCH_LIMIT });
      if (res.data?.success) {
        const data = res.data.data;
        const list: DonationRow[] = Array.isArray(data) ? data : data?.data || [];
        console.log("[DonationHandover] Loaded:", {
          total: list.length,
          pending: list.filter((r) => r.status === "pending").length,
          received: list.filter((r) => r.status === "received").length,
          rejected: list.filter((r) => r.status === "rejected").length,
        });
        setRows(list);
      }
    } catch (err) {
      console.error("[DonationHandover] List error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const grouped = useMemo(() => {
    const map: Record<DonationStatus, DonationRow[]> = { pending: [], received: [], rejected: [] };
    rows.forEach((row) => {
      const key = row.status as DonationStatus;
      if (map[key]) map[key].push(row);
    });
    return map;
  }, [rows]);

  const changeFilter = (next: StatusFilter) => {
    console.log("[DonationHandover] Filter:", next);
    setStatusFilter(next);
  };

  const visibleSections =
    statusFilter === "all" ? STATUS_SECTIONS : STATUS_SECTIONS.filter((s) => s.key === statusFilter);

  const filterButtons: { key: StatusFilter; label: string; count: number; dot?: string }[] = [
    { key: "all", label: "All", count: rows.length },
    ...STATUS_SECTIONS.map((s) => ({ key: s.key, label: s.label, count: grouped[s.key].length, dot: s.dot })),
  ];

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
    } catch (err: unknown) {
      console.error(err);
      setFeedback(apiErrorMessage(err, "Failed to approve donation."));
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
    } catch (err: unknown) {
      console.error(err);
      setFeedback(apiErrorMessage(err, "Failed to decline."));
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
        <div className="mb-4 px-4 py-3 rounded-lg bg-blue-50 text-blue-800 text-sm">{feedback}</div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div role="tablist" aria-label="Filter donations by status" className="flex flex-wrap gap-2">
          {filterButtons.map((btn) => {
            const active = statusFilter === btn.key;
            return (
              <button
                key={btn.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => changeFilter(btn.key)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  active
                    ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                }`}
              >
                {btn.dot && <span className={`h-2 w-2 rounded-full ${active ? "bg-white" : btn.dot}`} />}
                {btn.label}
                <span
                  className={`min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                    active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {loading && rows.length === 0 ? "…" : btn.count}
                </span>
              </button>
            );
          })}
        </div>
        <button
          onClick={fetchRows}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="space-y-6">
        {visibleSections.map((section) => {
          const sectionRows = grouped[section.key];
          const sectionTotal = sectionRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
          return (
            <section
              key={section.key}
              aria-labelledby={`donation-section-${section.key}`}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${section.dot}`} />
                  <h2 id={`donation-section-${section.key}`} className="font-semibold text-slate-800">
                    {section.label}
                  </h2>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${section.badge}`}>
                    {sectionRows.length}
                  </span>
                  <span className="hidden sm:inline text-xs text-slate-500">· {section.description}</span>
                </div>
                <span className="text-sm font-semibold text-slate-700">{formatPeso(sectionTotal)}</span>
              </div>
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
                      <CashierTableSkeleton columns={TABLE_COLUMNS} rows={3} />
                    ) : sectionRows.length === 0 ? (
                      <tr>
                        <td colSpan={TABLE_COLUMNS} className="py-10 text-center text-slate-500">
                          {section.empty}
                        </td>
                      </tr>
                    ) : (
                      sectionRows.map((row) => (
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
                          <td className="px-4 py-3 font-semibold text-blue-700">{formatPeso(row.amount)}</td>
                          <td className="px-4 py-3">{row.donation_date}</td>
                          <td className="px-4 py-3">{row.recorded_by || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${section.badge}`}>
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
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"
                              >
                                Review Cash
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setReview(row);
                                  setRejectMode(false);
                                }}
                                className="text-xs font-semibold text-blue-700 hover:underline"
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
            </section>
          );
        })}
      </div>

      {review && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-clear bg-opacity-20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Cash Denomination Preview</h3>
            <p className="text-sm text-slate-500 mb-1">
              {review.contribution_type === "donation" ? "Donation" : "Love Offering"} ·{" "}
              {review.donor_name} · Recorded by {review.recorded_by || "Secretary"}
            </p>
            <p className="text-base font-bold text-blue-700 mb-4">
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
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
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
