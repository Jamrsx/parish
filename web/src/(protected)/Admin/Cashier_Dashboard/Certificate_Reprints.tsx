import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Lock } from "lucide-react";
import { reprintsAPI, type CertificateReprintRow } from "../../../../library/certificates";
import { CashierTableSkeleton } from "./CashierSkeletons";

type View = "awaiting" | "history";

interface CertificateReprintsProps {
  onChanged?: () => void;
}

const formatPeso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatWhen = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";

const errorMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const CertificateReprints: React.FC<CertificateReprintsProps> = ({ onChanged }) => {
  const [view, setView] = useState<View>("awaiting");
  const [rows, setRows] = useState<CertificateReprintRow[]>([]);
  const [awaitingCount, setAwaitingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CertificateReprintRow | null>(null);
  const [orNumber, setOrNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      console.log("Fetching certificate reprints...", { view, search });
      const res = await reprintsAPI.cashierList({ view, search: search || undefined, per_page: 50 });
      if (res.data?.success) {
        setRows(res.data.data?.data || []);
        setAwaitingCount(res.data.awaiting_count ?? null);
      }
    } catch (err) {
      console.error("Certificate reprints error:", err);
      setFeedback({ type: "error", text: errorMessage(err, "Could not load certificate reprints.") });
    } finally {
      setLoading(false);
    }
  }, [view, search]);

  useEffect(() => {
    const t = setTimeout(fetchRows, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchRows, search]);

  const openPay = (row: CertificateReprintRow) => {
    setSelected(row);
    setOrNumber("");
    setNotes("");
    setModalError(null);
  };

  const submitPaid = async () => {
    if (!selected) return;
    if (orNumber.length > 50) {
      setModalError("OR / receipt number is too long (max 50 characters).");
      return;
    }
    setSubmitting(true);
    setModalError(null);
    try {
      console.log("Marking certificate reprint paid:", selected.reprint_id, { orNumber });
      const res = await reprintsAPI.markPaid(selected.reprint_id, {
        or_number: orNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      console.log("Mark paid response:", res.data);
      if (res.data?.success) {
        setFeedback({ type: "success", text: res.data.message || "Payment recorded." });
        setSelected(null);
        fetchRows();
        onChanged?.();
      } else {
        setModalError(res.data?.message || "Could not record the payment.");
      }
    } catch (err) {
      console.error("Mark paid error:", err);
      setModalError(errorMessage(err, "Could not record the payment."));
      fetchRows();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Certificate Reprints</h1>
        <p className="text-sm text-slate-500 mt-1">
          Collect the reprint fee, then mark it paid so the secretary can release the certificate.
        </p>
      </div>

      {feedback && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm flex justify-between gap-3 ${
            feedback.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="font-semibold" aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="tablist">
          {(
            [
              { id: "awaiting", label: "Awaiting payment" },
              { id: "history", label: "Paid history" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={view === tab.id}
              onClick={() => setView(tab.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 ${
                view === tab.id ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-800"
              }`}
            >
              {tab.label}
              {tab.id === "awaiting" && awaitingCount !== null && awaitingCount > 0 && (
                <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800">
                  {awaitingCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, OR no. or reprint #..."
          aria-label="Search certificate reprints"
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
        />
        <button
          onClick={fetchRows}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3">Reprint #</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Requested</th>
                <th className="text-left px-4 py-3">Fee</th>
                {view === "awaiting" ? (
                  <th className="text-left px-4 py-3">Action</th>
                ) : (
                  <>
                    <th className="text-left px-4 py-3">Paid</th>
                    <th className="text-left px-4 py-3">OR no.</th>
                    <th className="text-left px-4 py-3">Status</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && rows.length === 0 ? (
                <CashierTableSkeleton columns={view === "awaiting" ? 5 : 7} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={view === "awaiting" ? 5 : 7} className="py-16 text-center text-slate-500">
                    {view === "awaiting" ? "No reprints waiting for payment" : "No paid reprints yet"}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.reprint_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                        RP-{String(row.reprint_id).padStart(5, "0")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{row.person_name}</p>
                      <p className="text-xs text-slate-500">
                        Baptismal Certificate{row.reason ? ` · ${row.reason}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {formatWhen(row.requested_at)}
                      {row.requested_by && <span className="block">by {row.requested_by}</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{formatPeso(row.amount)}</td>
                    {view === "awaiting" ? (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openPay(row)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
                        >
                          Mark as paid
                        </button>
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {formatWhen(row.paid_at)}
                          {row.paid_by && <span className="block">by {row.paid_by}</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{row.or_number || "—"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              row.status === "released" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {row.status === "released" ? "RELEASED" : "PAID · WITH SECRETARY"}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-clear bg-opacity-20 backdrop-blur-sm p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="reprint-pay-title" className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6">
            <h3 id="reprint-pay-title" className="text-lg font-bold text-slate-800 mb-1">
              Record Reprint Payment
            </h3>
            <p className="text-sm text-slate-500 mb-1">{selected.person_name} · Baptismal Certificate</p>
            <p className="text-xs font-mono font-semibold text-blue-700 mb-4">
              Reprint RP-{String(selected.reprint_id).padStart(5, "0")}
            </p>

            <div className="mb-4 flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm">
              <span className="flex items-center gap-1.5 text-slate-600">
                <Lock size={14} aria-hidden /> Reprint fee (set by secretary)
              </span>
              <span className="text-xl font-bold text-slate-900">{formatPeso(selected.amount)}</span>
            </div>

            <label htmlFor="reprint-or" className="block text-sm font-medium text-slate-700 mb-1">
              OR / Receipt no. (optional)
            </label>
            <input
              id="reprint-or"
              value={orNumber}
              onChange={(e) => setOrNumber(e.target.value)}
              maxLength={50}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg mb-3"
            />
            <label htmlFor="reprint-notes" className="block text-sm font-medium text-slate-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              id="reprint-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg mb-4"
            />

            {modalError && (
              <p className="mb-4 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">{modalError}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setSelected(null)}
                disabled={submitting}
                className="px-4 py-2 bg-slate-100 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={submitPaid}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                <CheckCircle2 size={16} aria-hidden />
                {submitting ? "Saving..." : `Confirm ${formatPeso(selected.amount)} received`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CertificateReprints;
