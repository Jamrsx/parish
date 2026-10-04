import React, { useEffect, useState } from "react";
import type { AxiosResponse } from "axios";
import axios from "axios";
import { AlertTriangle, CalendarOff, Loader2, X } from "lucide-react";
import type { ApiResponse } from "../../../../library/api";
import {
  formatHm,
  TIME_OFF_END_TIMES,
  type PriestTimeOff,
  type TimeOffConflict,
  type TimeOffPayload,
} from "../../../../library/priestSchedule";

const START_TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const MAX_SPAN_DAYS = 92;

const pad = (n: number) => String(n).padStart(2, "0");
const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const daysBetween = (a: string, b: string) => {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};
const formatYmd = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
};

type SaveResponse = ApiResponse<PriestTimeOff> & { conflicts?: TimeOffConflict[] };

interface TimeOffFormModalProps {
  title: string;
  /** e.g. "for Fr. Juan Dela Cruz" when the secretary adds it */
  subtitle?: string;
  initial?: PriestTimeOff | null;
  defaultDate?: string;
  onSave: (payload: TimeOffPayload) => Promise<AxiosResponse<SaveResponse>>;
  onSaved: (message: string) => void;
  onClose: () => void;
}

const TimeOffFormModal: React.FC<TimeOffFormModalProps> = ({ title, subtitle, initial, defaultDate, onSave, onSaved, onClose }) => {
  const today = todayYmd();
  const startLocked = !!initial && initial.start_date < today;
  const firstDate = initial?.start_date ?? (defaultDate && defaultDate >= today ? defaultDate : today);

  const [startDate, setStartDate] = useState(firstDate);
  const [endDate, setEndDate] = useState(initial?.end_date ?? firstDate);
  const [wholeDay, setWholeDay] = useState(initial ? initial.whole_day : true);
  const [startTime, setStartTime] = useState(initial?.start_time ?? "08:00");
  const [endTime, setEndTime] = useState(initial?.end_time ?? "12:00");
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<TimeOffConflict[] | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const validate = (): string | null => {
    if (!startDate || !endDate) return "Choose the start and end dates.";
    if (!startLocked && startDate < today) return "The start date cannot be in the past.";
    if (endDate < startDate) return "The end date cannot be before the start date.";
    if (endDate < today) return "The end date cannot be in the past.";
    if (daysBetween(startDate, endDate) > MAX_SPAN_DAYS) return "One entry can cover at most 3 months.";
    if (!wholeDay && endTime <= startTime) return "The end time must be after the start time.";
    if (reason.length > 255) return "The reason is too long (max 255 characters).";
    return null;
  };

  const submit = async (confirm: boolean) => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    const payload: TimeOffPayload = {
      start_date: startDate,
      end_date: endDate,
      whole_day: wholeDay,
      start_time: wholeDay ? null : startTime,
      end_time: wholeDay ? null : endTime,
      reason: reason.trim() || null,
      ...(confirm ? { confirm: true } : {}),
    };
    console.log("[TimeOffForm] Submit", payload);
    setSaving(true);
    setError(null);
    try {
      const res = await onSave(payload);
      console.log("[TimeOffForm] Saved", res.data);
      if (res.data?.success) {
        onSaved(res.data.message || "Time off saved.");
      } else {
        setError(res.data?.message || "Could not save the time off.");
      }
    } catch (err) {
      console.error("[TimeOffForm] Save failed", err);
      if (axios.isAxiosError(err) && err.response?.status === 409 && err.response.data?.requires_confirmation) {
        setConflicts(err.response.data.conflicts || []);
      } else {
        setError(
          axios.isAxiosError(err)
            ? err.response?.data?.message || "Could not save the time off. Check your connection and try again."
            : "Could not save the time off."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50";

  return (
    <div
      className="fixed inset-0 bg-clear bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="time-off-title" className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <CalendarOff size={20} aria-hidden />
            </div>
            <div>
              <h3 id="time-off-title" className="text-lg font-bold text-slate-800">{title}</h3>
              {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        {conflicts ? (
          <div className="p-5">
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
              <p>
                This time off covers {conflicts.length === 1 ? "1 service that is" : `${conflicts.length} services that are`} already assigned.
                If you continue, the secretary will see {conflicts.length === 1 ? "it" : "them"} under <strong>Needs a new priest</strong> and reassign.
              </p>
            </div>
            <ul className="mt-3 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
              {conflicts.map((c) => (
                <li key={c.request_id} className="px-3 py-2 text-sm">
                  <p className="font-medium text-slate-800">{c.service_type}</p>
                  <p className="text-xs text-slate-500">
                    {formatYmd(c.date)}
                    {c.time ? ` · ${formatHm(c.time)}` : ""}
                    {c.requested_by ? ` · ${c.requested_by}` : ""} · Request #{c.request_id}
                  </p>
                </li>
              ))}
            </ul>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConflicts(null)} disabled={saving} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                Go back
              </button>
              <button type="button" onClick={() => submit(true)} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
                {saving && <Loader2 size={14} className="animate-spin" aria-hidden />}
                Save anyway
              </button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              submit(false);
            }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                From
                <input
                  type="date"
                  value={startDate}
                  min={startLocked ? undefined : today}
                  disabled={startLocked || saving}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStartDate(v);
                    if (endDate < v) setEndDate(v);
                    setError(null);
                  }}
                  className={`mt-1 ${inputClass}`}
                  required
                />
                {startLocked && <span className="mt-1 block text-xs text-slate-500">Already started, so the start date is fixed.</span>}
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Until
                <input
                  type="date"
                  value={endDate}
                  min={startDate > today ? startDate : today}
                  disabled={saving}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setError(null);
                  }}
                  className={`mt-1 ${inputClass}`}
                  required
                />
              </label>
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-slate-700">Unavailable for</legend>
              <div className="mt-1 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="radiogroup">
                {[
                  { value: true, label: "Whole day" },
                  { value: false, label: "Specific hours" },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    role="radio"
                    aria-checked={wholeDay === opt.value}
                    disabled={saving}
                    onClick={() => {
                      setWholeDay(opt.value);
                      setError(null);
                    }}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                      wholeDay === opt.value ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {!wholeDay && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-slate-700">
                  From time
                  <select value={startTime} disabled={saving} onChange={(e) => { setStartTime(e.target.value); setError(null); }} className={`mt-1 ${inputClass}`}>
                    {START_TIMES.map((t) => (
                      <option key={t} value={t}>{formatHm(t)}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Until time
                  <select value={endTime} disabled={saving} onChange={(e) => { setEndTime(e.target.value); setError(null); }} className={`mt-1 ${inputClass}`}>
                    {TIME_OFF_END_TIMES.map((t) => (
                      <option key={t} value={t} disabled={t <= startTime}>{formatHm(t)}</option>
                    ))}
                  </select>
                </label>
                <p className="col-span-2 -mt-1 text-xs text-slate-500">These hours apply to every day in the date range.</p>
              </div>
            )}

            <label className="block text-sm font-medium text-slate-700">
              Reason <span className="font-normal text-slate-400">(optional)</span>
              <input
                type="text"
                value={reason}
                maxLength={255}
                disabled={saving}
                placeholder="e.g. Retreat, diocesan meeting, sick leave"
                onChange={(e) => setReason(e.target.value)}
                className={`mt-1 ${inputClass}`}
              />
            </label>

            {error && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} disabled={saving} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {saving && <Loader2 size={14} className="animate-spin" aria-hidden />}
                {initial ? "Save changes" : "Save time off"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default TimeOffFormModal;
