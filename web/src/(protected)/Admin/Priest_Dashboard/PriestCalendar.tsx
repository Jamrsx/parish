import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle,
  CalendarOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import PriestPageShell from './components/PriestPageShell';
import TimeOffFormModal from '../components/TimeOffFormModal';
import {
  formatHm,
  formatShortDate,
  myCalendarAPI,
  timeOffCovers,
  timeOffShortLabel,
  type PriestAssignment,
  type PriestCalendarData,
  type PriestTimeOff,
} from '../../../../library/priestSchedule';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n: number) => String(n).padStart(2, '0');
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const monthEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const parseYmd = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const formatDay = (ymd: string) =>
  parseYmd(ymd).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const statusStyle: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  done: 'bg-purple-100 text-purple-800',
};

type FormState = { mode: 'add'; date?: string } | { mode: 'edit'; entry: PriestTimeOff } | null;

const PriestCalendar: React.FC = () => {
  const todayYmd = toYmd(new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(new Date()));
  const [selectedDate, setSelectedDate] = useState(todayYmd);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: PriestCalendarData; error?: string } | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [toRemove, setToRemove] = useState<PriestTimeOff | null>(null);
  const [removing, setRemoving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const range = useMemo(
    () => ({ from: toYmd(monthStart(visibleMonth)), to: toYmd(monthEnd(visibleMonth)) }),
    [visibleMonth]
  );
  const requestKey = `${range.from}|${range.to}|${reloadNonce}`;
  const loading = result?.key !== requestKey;
  const data = result?.key === requestKey ? result.data : undefined;
  const error = result?.key === requestKey ? result.error : undefined;
  const shown = data ?? result?.data;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      console.log('[MyCalendar] Loading', range);
      try {
        const res = await myCalendarAPI.get(range.from, range.to);
        console.log('[MyCalendar] Response', res.data);
        if (cancelled) return;
        if (res.data?.success && res.data.data) setResult({ key: requestKey, data: res.data.data });
        else setResult({ key: requestKey, error: res.data?.message || 'Could not load your calendar.' });
      } catch (err) {
        console.error('[MyCalendar] Load failed', err);
        if (cancelled) return;
        setResult({
          key: requestKey,
          error: axios.isAxiosError(err)
            ? err.response?.data?.message || 'Could not load your calendar. Check your connection and try again.'
            : 'Could not load your calendar.',
        });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [range, requestKey]);

  const reload = () => setReloadNonce((n) => n + 1);

  const assignmentsByDate = useMemo(() => {
    const map = new Map<string, PriestAssignment[]>();
    (shown?.assignments ?? []).forEach((a) => {
      const list = map.get(a.date) ?? [];
      list.push(a);
      map.set(a.date, list);
    });
    return map;
  }, [shown]);

  const timeOffOn = (ymd: string) => (shown?.time_off ?? []).filter((e) => timeOffCovers(e, ymd));

  const calendarCells = useMemo(() => {
    const first = monthStart(visibleMonth);
    const cells: (string | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= monthEnd(visibleMonth).getDate(); d++) {
      cells.push(toYmd(new Date(first.getFullYear(), first.getMonth(), d)));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [visibleMonth]);

  const changeMonth = (delta: number) => {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + delta, 1);
    console.log('[MyCalendar] Month', toYmd(next));
    setVisibleMonth(next);
    const now = new Date();
    setSelectedDate(next.getFullYear() === now.getFullYear() && next.getMonth() === now.getMonth() ? todayYmd : toYmd(next));
  };

  const onSaved = (message: string) => {
    setForm(null);
    setFeedback({ type: 'success', text: message });
    reload();
  };

  const confirmRemove = async () => {
    if (!toRemove) return;
    setRemoving(true);
    try {
      console.log('[MyCalendar] Remove', toRemove.time_off_id);
      const res = await myCalendarAPI.removeTimeOff(toRemove.time_off_id);
      setFeedback({ type: 'success', text: res.data?.message || 'Time off removed.' });
      setToRemove(null);
      reload();
    } catch (err) {
      console.error('[MyCalendar] Remove failed', err);
      setFeedback({
        type: 'error',
        text: axios.isAxiosError(err) ? err.response?.data?.message || 'Could not remove the time off.' : 'Could not remove the time off.',
      });
      setToRemove(null);
    } finally {
      setRemoving(false);
    }
  };

  const dayAssignments = assignmentsByDate.get(selectedDate) ?? [];
  const dayTimeOff = timeOffOn(selectedDate);
  const selectedIsPast = selectedDate < todayYmd;
  const upcoming = shown?.upcoming_time_off ?? [];

  const renderEntryActions = (entry: PriestTimeOff) =>
    entry.end_date >= todayYmd && (
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => setForm({ mode: 'edit', entry })}
          aria-label={`Edit time off ${entry.label}`}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-700"
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          onClick={() => setToRemove(entry)}
          aria-label={`Remove time off ${entry.label}`}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={15} />
        </button>
      </div>
    );

  return (
    <PriestPageShell subtitle="your availability calendar" onAvailabilityChanged={reload}>
      <div className="mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">My Calendar</h2>
          <p className="text-sm text-slate-500 mt-1">
            Mark the days or hours you can&apos;t take services. The secretary sees this and won&apos;t assign you then.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm({ mode: 'add', date: selectedIsPast ? todayYmd : selectedDate })}
          className="inline-flex items-center gap-2 self-start rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Mark unavailable
        </button>
      </div>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
            feedback.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          <span className="flex items-start gap-2">
            {feedback.type === 'error' ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
            {feedback.text}
          </span>
          <button type="button" onClick={() => setFeedback(null)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      )}

      {shown && !shown.is_available && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            Your availability switch is off
            {shown.unavailable_until ? ` until ${formatShortDate(shown.unavailable_until)}` : ''}. You&apos;ll be available again
            automatically after that date.
          </span>
        </div>
      )}

      {error && !loading ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-10 text-center">
          <AlertTriangle size={24} className="text-rose-600" />
          <p className="text-sm text-rose-800">{error}</p>
          <button type="button" onClick={reload} className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700">
            <RefreshCw size={14} />
            Try again
          </button>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Month calendar */}
          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-slate-800">
                  {visibleMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
                {loading && <Loader2 size={14} className="animate-spin text-slate-400" aria-label="Loading" />}
              </div>
              <button type="button" onClick={() => changeMonth(1)} aria-label="Next month" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-500">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>
            <div className={`grid grid-cols-7 gap-1 ${loading && !shown ? 'animate-pulse opacity-60' : ''}`}>
              {calendarCells.map((ymd, i) => {
                if (!ymd) return <div key={`blank-${i}`} className="h-20" />;
                const services = assignmentsByDate.get(ymd) ?? [];
                const off = timeOffOn(ymd);
                const wholeDayOff = off.some((e) => e.whole_day);
                const isSelected = ymd === selectedDate;
                const isToday = ymd === todayYmd;
                const isPast = ymd < todayYmd;
                return (
                  <button
                    key={ymd}
                    type="button"
                    onClick={() => setSelectedDate(ymd)}
                    aria-pressed={isSelected}
                    aria-label={`${formatDay(ymd)}: ${services.length} service${services.length === 1 ? '' : 's'}${off.length ? ', time off' : ''}`}
                    className={`flex h-20 flex-col items-stretch rounded-lg border p-1 text-left text-xs transition-colors ${
                      isSelected
                        ? 'border-blue-600 ring-2 ring-blue-200'
                        : wholeDayOff
                          ? 'border-slate-300 bg-[repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9_6px,#e2e8f0_6px,#e2e8f0_12px)]'
                          : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                    } ${isPast ? 'opacity-60' : ''}`}
                  >
                    <span className={`self-start rounded-full px-1.5 text-sm ${isToday ? 'bg-blue-600 font-bold text-white' : 'font-medium text-slate-700'}`}>
                      {parseYmd(ymd).getDate()}
                    </span>
                    <span className="mt-auto space-y-0.5">
                      {off.length > 0 && (
                        <span className="block truncate rounded bg-slate-700 px-1 text-[10px] font-semibold text-white">
                          {timeOffShortLabel(off[0])}
                        </span>
                      )}
                      {services.length > 0 && (
                        <span className="block truncate rounded bg-blue-100 px-1 text-[10px] font-semibold text-blue-800">
                          {services.length} service{services.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="rounded bg-blue-100 px-1 text-[10px] font-semibold text-blue-800">2 services</span>
                Assigned to you
              </span>
              <span className="flex items-center gap-1.5">
                <span className="rounded bg-slate-700 px-1 text-[10px] font-semibold text-white">Off</span>
                Your time off
              </span>
              <span className="flex items-center gap-1.5">
                <span className="rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">4</span>
                Today
              </span>
            </div>
          </div>

          {/* Selected day */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="font-semibold text-slate-800">{formatDay(selectedDate)}</p>
            <p className="text-xs text-slate-500 mb-3">
              {dayAssignments.length} service{dayAssignments.length === 1 ? '' : 's'}
              {dayTimeOff.length ? ' · time off' : ''}
            </p>

            {dayTimeOff.map((entry) => (
              <div key={entry.time_off_id} className="mb-2 flex items-start justify-between gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                    <CalendarOff size={14} /> Unavailable
                  </p>
                  <p className="text-xs text-slate-600">{entry.label}</p>
                  {entry.reason && <p className="text-xs text-slate-500">{entry.reason}</p>}
                  {!entry.added_by_priest && <p className="text-[11px] text-indigo-700">Added by the parish office</p>}
                </div>
                {renderEntryActions(entry)}
              </div>
            ))}

            {dayAssignments.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
                No services assigned on this day.
              </p>
            ) : (
              <ul className="space-y-2">
                {dayAssignments.map((a) => {
                  const blocked = dayTimeOff.some((e) => timeOffCovers(e, selectedDate, a.time)) && a.status !== 'done';
                  return (
                    <li key={a.request_id} className={`rounded-lg border px-3 py-2 ${blocked ? 'border-amber-300 bg-amber-50' : 'border-blue-200 bg-blue-50'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                          <Clock size={12} /> {a.time ? formatHm(a.time) : 'No time set'}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyle[a.status] || 'bg-slate-100 text-slate-700'}`}>
                          {a.status === 'done' ? 'Completed' : a.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{a.service_type}</p>
                      <p className="text-xs text-slate-600">{a.client_name || 'No name'} · Request #{a.request_id}</p>
                      {blocked && <p className="mt-1 text-[11px] text-amber-800">You marked this time off — the secretary will reassign it.</p>}
                    </li>
                  );
                })}
              </ul>
            )}

            {!selectedIsPast && (
              <button
                type="button"
                onClick={() => setForm({ mode: 'add', date: selectedDate })}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <CalendarOff size={15} />
                Mark this day unavailable
              </button>
            )}
          </div>

          {/* Upcoming time off */}
          <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Upcoming time off</h3>
              <p className="text-xs text-slate-500">Past entries are kept for records and can no longer be changed.</p>
            </div>
            {upcoming.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">You have no upcoming time off.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {upcoming.map((entry) => (
                  <li key={entry.time_off_id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        setVisibleMonth(monthStart(parseYmd(entry.start_date < todayYmd ? todayYmd : entry.start_date)));
                        setSelectedDate(entry.start_date < todayYmd ? todayYmd : entry.start_date);
                      }}
                      className="min-w-0 text-left hover:underline"
                      title="Show in calendar"
                    >
                      <p className="text-sm font-medium text-slate-800">{entry.label}</p>
                      <p className="text-xs text-slate-500">
                        {entry.reason || 'No reason given'}
                        {!entry.added_by_priest && entry.created_by_name ? ` · added by ${entry.created_by_name}` : ''}
                      </p>
                    </button>
                    {renderEntryActions(entry)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {form && (
        <TimeOffFormModal
          title={form.mode === 'edit' ? 'Edit time off' : 'Mark unavailable'}
          initial={form.mode === 'edit' ? form.entry : null}
          defaultDate={form.mode === 'add' ? form.date : undefined}
          onSave={(payload) =>
            form.mode === 'edit' ? myCalendarAPI.updateTimeOff(form.entry.time_off_id, payload) : myCalendarAPI.addTimeOff(payload)
          }
          onSaved={onSaved}
          onClose={() => setForm(null)}
        />
      )}

      {toRemove && (
        <div className="fixed inset-0 bg-clear bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="remove-title" className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 id="remove-title" className="text-lg font-bold text-slate-800">Remove this time off?</h3>
            <p className="mt-2 text-sm text-slate-600">
              {toRemove.label}
              {toRemove.reason ? ` (${toRemove.reason})` : ''}. You&apos;ll be available for assignments again on these dates.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setToRemove(null)} disabled={removing} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                Keep it
              </button>
              <button type="button" onClick={confirmRemove} disabled={removing} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {removing && <Loader2 size={14} className="animate-spin" />}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </PriestPageShell>
  );
};

export default PriestCalendar;
