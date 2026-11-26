import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import ServiceTimelineList from "./ServiceTimelineList";
import {
  historyAPI,
  formatClock,
  formatDay,
  formatPeso,
  SERVICE_STATUS_LABELS,
  type HistoryScope,
  type ServiceTimeline,
} from "../../../../../library/history";


interface ServiceTimelineModalProps {
  scope: HistoryScope;
  requestId: number;
  onClose: () => void;
}

const ServiceTimelineModal: React.FC<ServiceTimelineModalProps> = ({ scope, requestId, onClose }) => {
  const api = useMemo(() => historyAPI(scope), [scope]);
  const [result, setResult] = useState<{ id: number; data: ServiceTimeline | null; error: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    console.log("[History:Timeline] Loading", requestId);
    api
      .timeline(requestId)
      .then((res) => {
        if (cancelled) return;
        console.log("[History:Timeline] Loaded", res.data.data);
        setResult({ id: requestId, data: res.data.data, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[History:Timeline] Error", err);
        setResult({
          id: requestId,
          data: null,
          error: err?.response?.data?.message || "Could not load this service's history.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [api, requestId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const loading = result?.id !== requestId;
  const req = result?.data?.request;
  const events = result?.data?.events ?? [];

  return (
    <div
      className="fixed inset-0 bg-clear bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="timeline-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 id="timeline-title" className="text-lg font-semibold text-slate-900">
              Service history
            </h3>
            <p className="text-sm text-slate-500">
              {req ? `${req.reference} · ${req.service_type}` : "Loading…"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : result?.error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</p>
          ) : req ? (
            <>
              <dl className="mb-5 grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">Name</dt>
                  <dd className="font-medium text-slate-900">{req.client_name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Requested by</dt>
                  <dd className="font-medium text-slate-900">{req.requested_by || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Service date</dt>
                  <dd className="font-medium text-slate-900">
                    {formatDay(req.preferred_date)} {req.preferred_time && `· ${formatClock(req.preferred_time)}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Status</dt>
                  <dd className="font-medium text-slate-900">{SERVICE_STATUS_LABELS[req.status]}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Priest</dt>
                  <dd className="font-medium text-slate-900">{req.assigned_priest || "Not assigned"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Payment</dt>
                  <dd className="font-medium text-slate-900">
                    {req.fee > 0 ? `${formatPeso(req.amount_paid)} of ${formatPeso(req.fee)} (${req.payment_status})` : "No fee"}
                  </dd>
                </div>
              </dl>

              <ServiceTimelineList events={events} />
            </>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceTimelineModal;
