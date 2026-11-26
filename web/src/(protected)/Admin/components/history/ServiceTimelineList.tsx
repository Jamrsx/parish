import React from "react";
import {
  Award,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  FilePlus2,
  Pencil,
  UserCheck,
  Wallet,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatDateTime, formatPeso, type TimelineEvent, type TimelineEventType } from "../../../../../library/history";

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

interface ServiceTimelineListProps {
  events: TimelineEvent[];
  /** Smaller spacing for use inside another panel */
  compact?: boolean;
}

/** Every step of a service with its exact date and time: requested, booked, paid, completed, cancelled, ... */
const ServiceTimelineList: React.FC<ServiceTimelineListProps> = ({ events, compact = false }) => {
  if (events.length === 0) {
    return <p className="text-sm text-slate-500">No activity recorded yet.</p>;
  }

  return (
    <ol className="relative ml-4 border-l border-slate-200">
      {events.map((ev, i) => {
        const style = EVENT_STYLE[ev.type] ?? EVENT_STYLE.edited;
        const Icon = style.icon;
        return (
          <li key={`${ev.type}-${ev.at}-${i}`} className={`${compact ? "mb-3.5" : "mb-5"} ml-6 last:mb-0`}>
            <span
              className={`absolute -left-3.5 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-white ${style.tone}`}
            >
              <Icon size={14} aria-hidden />
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm font-semibold text-slate-900">
                {ev.title}
                {ev.amount !== null && (
                  <span className="ml-2 font-semibold tabular-nums text-emerald-700">{formatPeso(ev.amount)}</span>
                )}
              </p>
              <time dateTime={ev.at} className="text-xs tabular-nums text-slate-500">
                {formatDateTime(ev.at)}
              </time>
            </div>
            {ev.detail && <p className="mt-0.5 text-sm text-slate-600">{ev.detail}</p>}
            {ev.by && <p className="mt-0.5 text-xs text-slate-500">by {ev.by}</p>}
          </li>
        );
      })}
    </ol>
  );
};

export default ServiceTimelineList;
