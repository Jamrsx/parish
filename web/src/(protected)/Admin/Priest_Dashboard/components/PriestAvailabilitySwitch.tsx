import React, { useState } from 'react';
import axios from 'axios';
import { CalendarClock, Loader2, X } from 'lucide-react';
import { useAuth } from '../../../../../context/AuthContext';
import { usersAPI } from '../../../../../library/api';
import { formatShortDate } from '../../../../../library/priestSchedule';

type Choice = 'today' | 'tomorrow' | 'date';

const pad = (n: number) => String(n).padStart(2, '0');
const ymdIn = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

interface PriestAvailabilitySwitchProps {
  onChanged?: () => void;
}

const PriestAvailabilitySwitch: React.FC<PriestAvailabilitySwitchProps> = ({ onChanged }) => {
  const { user, updateUser } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [choice, setChoice] = useState<Choice>('today');
  const [pickedDate, setPickedDate] = useState(ymdIn(2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const until = user?.unavailable_until ?? null;
  const untilPassed = !!until && new Date(until).getTime() < Date.now();
  const isOn = user?.is_available !== false || untilPassed;

  const save = async (nextOn: boolean, untilDate?: string) => {
    setSaving(true);
    setError(null);
    try {
      console.log('[AvailabilitySwitch] Update', { nextOn, untilDate });
      const res = await usersAPI.updateAvailability(nextOn, untilDate);
      if (res.data?.success && res.data.data) {
        updateUser(res.data.data);
        setNotice(res.data.message || null);
        setModalOpen(false);
        onChanged?.();
      } else {
        setError(res.data?.message || 'Could not update your availability.');
      }
    } catch (err) {
      console.error('[AvailabilitySwitch] Update failed', err);
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || 'Could not update your availability. Check your connection and try again.'
          : 'Could not update your availability.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = () => {
    setNotice(null);
    if (isOn) {
      setChoice('today');
      setPickedDate(ymdIn(2));
      setError(null);
      setModalOpen(true);
    } else {
      save(true);
    }
  };

  const confirmOff = () => {
    const date = choice === 'today' ? ymdIn(0) : choice === 'tomorrow' ? ymdIn(1) : pickedDate;
    if (!date || date < ymdIn(0)) {
      setError('Choose today or a future date.');
      return;
    }
    if (date > ymdIn(30)) {
      setError('Pick a date within 30 days. For longer time off, use My Calendar.');
      return;
    }
    save(false, date);
  };

  return (
    <>
      <div className="flex flex-col items-end">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${isOn ? 'text-green-600' : 'text-red-600'}`}>
            {isOn ? 'Available' : until ? `Unavailable until ${formatShortDate(until)}` : 'Unavailable'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isOn}
            aria-label={isOn ? 'Mark yourself unavailable' : 'Mark yourself available'}
            onClick={handleToggle}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 ${
              isOn ? 'bg-green-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isOn ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {!isOn && until && (
          <span className="text-[11px] text-slate-500">Turns back on automatically</span>
        )}
        {notice && !modalOpen && <span role="status" className="mt-0.5 max-w-xs text-right text-[11px] text-emerald-700">{notice}</span>}
        {error && !modalOpen && <span role="alert" className="mt-0.5 max-w-xs text-right text-[11px] text-red-600">{error}</span>}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 bg-clear bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setModalOpen(false);
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="until-title" className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <CalendarClock size={20} aria-hidden />
                </div>
                <div>
                  <h3 id="until-title" className="text-lg font-bold text-slate-800">Unavailable until when?</h3>
                  <p className="text-sm text-slate-500">You'll be available again automatically after this date.</p>
                </div>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} disabled={saving} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 p-5" role="radiogroup" aria-label="Unavailable until">
              {([
                { value: 'today', label: 'End of today', hint: formatShortDate(ymdIn(0)) },
                { value: 'tomorrow', label: 'End of tomorrow', hint: formatShortDate(ymdIn(1)) },
                { value: 'date', label: 'Pick a date', hint: 'Up to 30 days' },
              ] as { value: Choice; label: string; hint: string }[]).map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
                    choice === opt.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="until-choice"
                      checked={choice === opt.value}
                      onChange={() => {
                        setChoice(opt.value);
                        setError(null);
                      }}
                      className="h-4 w-4 text-blue-600"
                    />
                    <span className="text-sm font-medium text-slate-800">{opt.label}</span>
                  </span>
                  <span className="text-xs text-slate-500">{opt.hint}</span>
                </label>
              ))}

              {choice === 'date' && (
                <input
                  type="date"
                  aria-label="Unavailable until date"
                  value={pickedDate}
                  min={ymdIn(0)}
                  max={ymdIn(30)}
                  onChange={(e) => {
                    setPickedDate(e.target.value);
                    setError(null);
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              )}

              <p className="pt-1 text-xs text-slate-500">
                The secretary won't be able to assign you to services up to that date. Services already assigned to you stay as they are.
              </p>
              {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
              <button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={confirmOff} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
                {saving && <Loader2 size={14} className="animate-spin" aria-hidden />}
                Mark unavailable
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PriestAvailabilitySwitch;
