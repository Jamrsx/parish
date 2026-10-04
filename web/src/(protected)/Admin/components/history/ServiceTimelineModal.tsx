import React, { useEffect, useMemo, useState } from "react";
import {
  Award,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  FilePlus2,
  Pencil,
  UserCheck,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  historyAPI,
  formatClock,
  formatDateTime,
  formatDay,
  formatPeso,
  SERVICE_STATUS_LABELS,
  type HistoryScope,
  type ServiceTimeline,
  type TimelineEventType,
} from "../../../../../library/history";

const EVENT_STYLE: Record<TimelineEventType, { icon: LucideIcon; tone: string }> = {
  requested: { icon: FilePlus2, tone: "bg-slate-100 text-slate-600" },
  approved: { icon: CheckCircle2, tone: "bg-blue-100 text-blue-700" },
  priest_assigned: { icon: UserCheck, tone: "bg-indigo-100 text-indigo-700" },
  rescheduled: { icon: CalendarClock, tone: "bg-violet-100 text-violet-700" },
  paid: { icon: Wallet, tone: "bg-emerald-100 text-emerald-700" },
  completed: { icon: BadgeCheck, tone: "bg-emerald-100 text-emerald-700" },
  cancelled: { icon: XCircle, tone: "bg-red-100 text-red-700" },
  certificate: { icon: Award, tone: "bg-amber-100 text-amber-700" },
  edited: { icon: Pencil, tone: "bg-slate-100 text-slate-600" },
};

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

              <ol className="relative ml-4 border-l border-slate-200">
                {events.map((ev, i) => {
                  const style = EVENT_STYLE[ev.type] ?? EVENT_STYLE.edited;
                  const Icon = style.icon;
                  return (
                    <li key={`${ev.type}-${ev.at}-${i}`} className="mb-5 ml-6 last:mb-0">
                      <span
                        className={`absolute -left-3.5 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-white ${style.tone}`}
                      >
                        <Icon size={14} aria-hidden />
                      </span>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="text-sm font-semibold text-slate-900">
                          {ev.title}
                          {ev.amount !== null && (
                            <span className="ml-2 font-semibold text-emerald-700">{formatPeso(ev.amount)}</span>
                          )}
                        </p>
                        <time className="text-xs text-slate-500">{formatDateTime(ev.at)}</time>
                      </div>
                      {ev.detail && <p className="mt-0.5 text-sm text-slate-600">{ev.detail}</p>}
                      {ev.by && <p className="mt-0.5 text-xs text-slate-400">by {ev.by}</p>}
                    </li>
                  );
                })}
              </ol>
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
