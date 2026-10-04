import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListChecks,
  RefreshCw,
  UserRound,
} from 'lucide-react';
import ModalCloseButton from './ModalCloseButton';
import StatusBadge from './StatusBadge';
import { priestScheduleAPI } from '../../../../../library/priestSchedule';
import type {
  OtherBooking,
  PriestAssignment,
  PriestScheduleDetails,
} from '../../../../../library/priestSchedule';

interface PriestScheduleModalProps {
  priestId: number;
  priestName: string;
  onClose: () => void;
}

type Tab = 'calendar' | 'upcoming';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const UPCOMING_DAYS = 90;

const pad = (n: number) => String(n).padStart(2, '0');
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const monthEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
const parseYmd = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatTime = (hm: string) => {
  if (!hm) return 'No time set';
  const [h, m] = hm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${pad(m || 0)} ${suffix}`;
};

const formatDay = (ymd: string, withYear = true) =>
  parseYmd(ymd).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'P';

const isPastSlot = (ymd: string, hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  const slot = parseYmd(ymd);
  slot.setHours(h, m || 0, 0, 0);
  return slot.getTime() <= Date.now();
};

const PriestScheduleModal: React.FC<PriestScheduleModalProps> = ({ priestId, priestName, onClose }) => {
  const todayYmd = toYmd(new Date());
  const [tab, setTab] = useState<Tab>('calendar');
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(new Date()));
  const [selectedDate, setSelectedDate] = useState(todayYmd);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: PriestScheduleDetails; error?: string } | null>(null);

  const range = useMemo(() => {
    if (tab === 'upcoming') {
      const start = new Date();
      return { from: toYmd(start), to: toYmd(addDays(start, UPCOMING_DAYS)) };
    }
    return { from: toYmd(monthStart(visibleMonth)), to: toYmd(monthEnd(visibleMonth)) };
  }, [tab, visibleMonth]);

  const requestKey = `${priestId}|${range.from}|${range.to}|${reloadNonce}`;
  const loading = result?.key !== requestKey;
  const data = result?.key === requestKey ? result.data : undefined;
  const error = result?.key === requestKey ? result.error : undefined;
  const lastData = data ?? result?.data;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      console.log('[PriestSchedule] Loading', { priestId, ...range });
      try {
        const response = await priestScheduleAPI.getSchedule(priestId, range.from, range.to);
        console.log('[PriestSchedule] Response', response.data);
        if (cancelled) return;
        if (response.data?.success && response.data.data) {
          setResult({ key: requestKey, data: response.data.data });
        } else {
          setResult({ key: requestKey, error: response.data?.message || 'Could not load the schedule.' });
        }
      } catch (err) {
        console.error('[PriestSchedule] Load failed', err);
        if (cancelled) return;
        const message = axios.isAxiosError(err)
          ? err.response?.data?.message || 'Could not load the schedule. Check your connection and try again.'
          : 'Could not load the schedule.';
        setResult({ key: requestKey, error: message });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [priestId, range, requestKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const assignmentsByDate = useMemo(() => {
    const map = new Map<string, PriestAssignment[]>();
    (data?.assignments ?? []).forEach((a) => {
      const list = map.get(a.date) ?? [];
      list.push(a);
      map.set(a.date, list);
    });
    return map;
  }, [data]);

  const othersByDate = useMemo(() => {
    const map = new Map<string, OtherBooking[]>();
    (data?.other_bookings ?? []).forEach((b) => {
      const list = map.get(b.date) ?? [];
      list.push(b);
      map.set(b.date, list);
    });
    return map;
  }, [data]);

  const timeSlots = data?.time_slots ?? lastData?.time_slots ?? [];
  const priest = lastData?.priest;
  const summary = lastData?.summary;
  const displayName = priest?.full_name || priestName;

  const changeMonth = (delta: number) => {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + delta, 1);
    console.log('[PriestSchedule] Month change', toYmd(next));
    setVisibleMonth(next);
    const sameMonthAsToday = next.getFullYear() === new Date().getFullYear() && next.getMonth() === new Date().getMonth();
    setSelectedDate(sameMonthAsToday ? todayYmd : toYmd(next));
  };

  const goToday = () => {
    setVisibleMonth(monthStart(new Date()));
    setSelectedDate(todayYmd);
    setTab('calendar');
  };

  const openDay = (ymd: string) => {
    console.log('[PriestSchedule] Day selected', ymd);
    const date = parseYmd(ymd);
    setVisibleMonth(monthStart(date));
    setSelectedDate(ymd);
    setTab('calendar');
  };

  const calendarCells = useMemo(() => {
    const first = monthStart(visibleMonth);
    const daysInMonth = monthEnd(visibleMonth).getDate();
    const cells: (string | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(toYmd(new Date(first.getFullYear(), first.getMonth(), d)));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [visibleMonth]);

  const dayAssignments = assignmentsByDate.get(selectedDate) ?? [];
  const dayOthers = othersByDate.get(selectedDate) ?? [];
  const offSlotAssignments = dayAssignments.filter((a) => !timeSlots.includes(a.time));
  const openCount = timeSlots.filter(
    (slot) =>
      !dayAssignments.some((a) => a.time === slot) &&
      !dayOthers.some((b) => b.time === slot) &&
      !isPastSlot(selectedDate, slot)
  ).length;

  const upcomingGroups = useMemo(() => {
    if (tab !== 'upcoming' || !data) return [];
    const groups: { date: string; items: PriestAssignment[] }[] = [];
    data.assignments
      .filter((a) => a.status !== 'done' && !(a.time && isPastSlot(a.date, a.time)))
      .forEach((a) => {
        const last = groups[groups.length - 1];
        if (last && last.date === a.date) last.items.push(a);
        else groups.push({ date: a.date, items: [a] });
      });
    return groups;
  }, [tab, data]);

  const renderAvailabilityBadge = () => {
    if (!priest) return null;
    if (!priest.is_active) {
      return (
        <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          Disabled account
        </span>
      );
    }
    return priest.is_available ? (
      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
        Available for assignments
      </span>
    ) : (
      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
        Unavailable (set by priest)
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-clear bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="priest-schedule-title"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-base font-bold text-blue-700">
              {initials(displayName)}
            </div>
            <div className="min-w-0">
              <h3 id="priest-schedule-title" className="truncate text-xl font-bold text-slate-800">
                {displayName}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {renderAvailabilityBadge()}
                {priest?.email && <span className="truncate text-xs text-slate-500">{priest.email}</span>}
              </div>
            </div>
          </div>
          <ModalCloseButton onClick={onClose} />
        </div>

        <div className="overflow-y-auto p-5">
          {/* Stats */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">This week</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">{summary ? summary.this_week_count : '–'}</p>
              <p className="text-xs text-slate-500">upcoming assignments</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">This month</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">{summary ? summary.this_month_count : '–'}</p>
              <p className="text-xs text-slate-500">upcoming assignments</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Next assignment</p>
              {summary?.next_assignment ? (
                <button
                  type="button"
                  onClick={() => openDay(summary.next_assignment!.date)}
                  className="mt-1 text-left hover:underline"
                  title="Show this day"
                >
                  <p className="text-sm font-semibold text-slate-800">
                    {formatDay(summary.next_assignment.date, false)} · {formatTime(summary.next_assignment.time)}
                  </p>
                  <p className="text-xs text-slate-500">{summary.next_assignment.service_type}</p>
                </button>
              ) : (
                <p className="mt-1 text-sm text-slate-500">{summary ? 'None scheduled' : '–'}</p>
              )}
            </div>
          </div>

          {priest && (!priest.is_active || !priest.is_available) && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <span>
                {!priest.is_active
                  ? `${displayName}'s account is disabled, so he can't be assigned to any request.`
                  : `${displayName} marked himself unavailable, so he can't be assigned new requests right now. Existing assignments below still stand.`}
              </span>
            </div>
          )}

          {/* Tabs */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'calendar'}
                onClick={() => setTab('calendar')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === 'calendar' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <CalendarDays size={15} />
                Calendar
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'upcoming'}
                onClick={() => setTab('upcoming')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === 'upcoming' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <ListChecks size={15} />
                Upcoming
              </button>
            </div>
            <button
              type="button"
              onClick={goToday}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Today
            </button>
          </div>

          {error && !loading ? (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-8 text-center">
              <AlertTriangle size={24} className="text-rose-600" />
              <p className="text-sm text-rose-800">{error}</p>
              <button
                type="button"
                onClick={() => setReloadNonce((n) => n + 1)}
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
              >
                <RefreshCw size={14} />
                Try again
              </button>
            </div>
          ) : tab === 'calendar' ? (
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              {/* Month calendar */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => changeMonth(-1)}
                    aria-label="Previous month"
                    className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <p className="font-semibold text-slate-800">
                    {visibleMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                  <button
                    type="button"
                    onClick={() => changeMonth(1)}
                    aria-label="Next month"
                    className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-500">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="py-1">
                      {d}
                    </div>
                  ))}
                </div>

                <div className={`grid grid-cols-7 gap-1 ${loading ? 'animate-pulse opacity-60' : ''}`}>
                  {calendarCells.map((ymd, i) => {
                    if (!ymd) return <div key={`blank-${i}`} className="h-12" />;
                    const mine = assignmentsByDate.get(ymd)?.length ?? 0;
                    const others = othersByDate.get(ymd)?.length ?? 0;
                    const isFull = timeSlots.length > 0 && mine + others >= timeSlots.length;
                    const isSelected = ymd === selectedDate;
                    const isToday = ymd === todayYmd;
                    const isPast = ymd < todayYmd;
                    return (
                      <button
                        key={ymd}
                        type="button"
                        onClick={() => openDay(ymd)}
                        aria-pressed={isSelected}
                        aria-label={`${formatDay(ymd)}: ${mine} assignment${mine === 1 ? '' : 's'}`}
                        className={`relative flex h-12 flex-col items-center justify-center rounded-lg border text-sm transition-colors ${
                          isSelected
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : isFull
                              ? 'border-rose-100 bg-rose-50 text-rose-700 hover:border-rose-300'
                              : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                        } ${isPast && !isSelected ? 'text-slate-400' : ''} ${
                          isToday && !isSelected ? 'ring-2 ring-blue-300' : ''
                        }`}
                      >
                        <span className={isToday ? 'font-bold' : 'font-medium'}>{parseYmd(ymd).getDate()}</span>
                        {mine > 0 && (
                          <span
                            className={`mt-0.5 rounded-full px-1.5 text-[10px] font-bold leading-4 ${
                              isSelected ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {mine}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="rounded-full bg-blue-100 px-1.5 text-[10px] font-bold text-blue-700">2</span>
                    Assignments for this priest
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded border border-rose-200 bg-rose-50" />
                    Parish fully booked
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded ring-2 ring-blue-300" />
                    Today
                  </span>
                </div>
              </div>

              {/* Day timeline */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">{formatDay(selectedDate)}</p>
                    <p className="text-xs text-slate-500">
                      {loading
                        ? 'Loading…'
                        : `${dayAssignments.length} assigned to this priest · ${openCount} open slot${openCount === 1 ? '' : 's'}`}
                    </p>
                  </div>
                </div>

                {loading && !data ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {timeSlots.map((slot) => {
                      const mine = dayAssignments.find((a) => a.time === slot);
                      const other = dayOthers.find((b) => b.time === slot);
                      const passed = isPastSlot(selectedDate, slot);

                      if (mine) {
                        return (
                          <li
                            key={slot}
                            className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2"
                          >
                            <span className="w-16 shrink-0 pt-0.5 text-xs font-semibold text-blue-800">
                              {formatTime(slot)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-800">{mine.service_type}</p>
                              <p className="truncate text-xs text-slate-600">
                                {mine.client_name || 'No name'} · Request #{mine.request_id}
                              </p>
                            </div>
                            <StatusBadge status={mine.status} label={mine.status === 'done' ? 'Completed' : undefined} />
                          </li>
                        );
                      }

                      if (other) {
                        return (
                          <li
                            key={slot}
                            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                          >
                            <span className="w-16 shrink-0 text-xs font-semibold text-slate-500">{formatTime(slot)}</span>
                            <p className="min-w-0 flex-1 truncate text-sm text-slate-600">
                              Taken · {other.service_type}
                              <span className="text-slate-400">
                                {other.assigned_priest_name ? ` (${other.assigned_priest_name.trim()})` : ' (no priest yet)'}
                              </span>
                            </p>
                          </li>
                        );
                      }

                      return (
                        <li
                          key={slot}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                            passed ? 'border-slate-100 bg-white text-slate-400' : 'border-emerald-100 bg-emerald-50/60'
                          }`}
                        >
                          <span className={`w-16 shrink-0 text-xs font-semibold ${passed ? '' : 'text-emerald-800'}`}>
                            {formatTime(slot)}
                          </span>
                          <p className={`text-sm ${passed ? '' : 'font-medium text-emerald-700'}`}>
                            {passed ? 'Passed' : 'Open — free at this time'}
                          </p>
                        </li>
                      );
                    })}

                    {offSlotAssignments.map((a) => (
                      <li
                        key={`extra-${a.request_id}`}
                        className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2"
                      >
                        <span className="w-16 shrink-0 pt-0.5 text-xs font-semibold text-blue-800">
                          {formatTime(a.time)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{a.service_type}</p>
                          <p className="truncate text-xs text-slate-600">
                            {a.client_name || 'No name'} · Request #{a.request_id}
                          </p>
                        </div>
                        <StatusBadge status={a.status} label={a.status === 'done' ? 'Completed' : undefined} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <p className="mb-3 text-xs text-slate-500">
                Pending and approved assignments for the next {UPCOMING_DAYS} days. Click a date to open it in the calendar.
              </p>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
                  ))}
                </div>
              ) : upcomingGroups.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center">
                  <UserRound size={28} className="text-slate-300" />
                  <p className="font-medium text-slate-700">No upcoming assignments</p>
                  <p className="text-sm text-slate-500">{displayName} is free for the next {UPCOMING_DAYS} days.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingGroups.map((group) => (
                    <div key={group.date}>
                      <button
                        type="button"
                        onClick={() => openDay(group.date)}
                        className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-blue-700"
                      >
                        <CalendarDays size={14} />
                        {formatDay(group.date)}
                        {group.date === todayYmd && (
                          <span className="rounded-full bg-blue-100 px-2 text-[10px] font-bold text-blue-700">Today</span>
                        )}
                      </button>
                      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                        {group.items.map((a) => (
                          <li key={a.request_id} className="flex items-center gap-3 px-3 py-2.5">
                            <span className="flex w-20 shrink-0 items-center gap-1 text-xs font-semibold text-slate-700">
                              <Clock size={12} className="text-slate-400" />
                              {formatTime(a.time)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-800">{a.service_type}</p>
                              <p className="truncate text-xs text-slate-500">
                                {a.client_name || 'No name'} · Request #{a.request_id}
                              </p>
                            </div>
                            <StatusBadge status={a.status} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PriestScheduleModal;
