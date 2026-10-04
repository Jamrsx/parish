import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { fetchFullyBookedMonth, toYmd } from './serviceSlots';

interface ServiceDatePickerProps {
  id?: string;
  value: string;
  onChange: (date: string) => void;
  /** Earliest selectable date (Y-m-d). Defaults to today. */
  min?: string;
  /** Disable days where every service time is booked. Off for certificate visit dates. */
  blockFullyBooked?: boolean;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  invalid?: boolean;
  className?: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const parseYmd = (ymd: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

const formatDisplay = (ymd: string): string => {
  const d = parseYmd(ymd);
  return d
    ? d.toLocaleDateString('en-PH', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
    : '';
};

const ServiceDatePicker: React.FC<ServiceDatePickerProps> = ({
  id,
  value,
  onChange,
  min,
  blockFullyBooked = true,
  disabled = false,
  placeholder = 'Select date',
  ariaLabel = 'Date',
  invalid = false,
  className = '',
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const base = parseYmd(value) || parseYmd(min || '') || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [booked, setBooked] = useState<{ month: string; dates: string[]; error: boolean } | null>(null);

  const minYmd = min || toYmd(new Date());
  const todayYmd = toYmd(new Date());
  const currentMonth = monthKey(viewMonth);
  const loadingMonth = blockFullyBooked && open && booked?.month !== currentMonth;

  useEffect(() => {
    if (!open || !blockFullyBooked) return;
    let cancelled = false;
    fetchFullyBookedMonth(currentMonth)
      .then((dates) => {
        if (!cancelled) setBooked({ month: currentMonth, dates, error: false });
      })
      .catch((err) => {
        console.error('[Booking] Fully booked dates failed', err);
        if (!cancelled) setBooked({ month: currentMonth, dates: [], error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [open, currentMonth, blockFullyBooked]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggleOpen = () => {
    if (disabled) return;
    if (!open) {
      const base = parseYmd(value) || parseYmd(minYmd) || new Date();
      setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    }
    setOpen((o) => !o);
  };

  const fullSet = new Set(booked?.month === currentMonth ? booked.dates : []);
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const minDate = parseYmd(minYmd);
  const canGoBack = !minDate || new Date(year, month, 1) > new Date(minDate.getFullYear(), minDate.getMonth(), 1);

  const pick = (ymd: string) => {
    console.log('[Booking] Date picked', ymd);
    onChange(ymd);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        onClick={toggleOpen}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2.5 text-left text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${
          invalid ? 'border-red-400' : 'border-slate-200'
        }`}
      >
        <span className={value ? 'text-slate-900' : 'text-slate-400'}>{value ? formatDisplay(value) : placeholder}</span>
        <CalendarDays size={16} className="shrink-0 text-slate-400" aria-hidden />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a date"
          className="absolute left-0 z-40 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth(new Date(year, month - 1, 1))}
              disabled={!canGoBack}
              aria-label="Previous month"
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              {viewMonth.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
              {loadingMonth && <Loader2 size={13} className="animate-spin text-slate-400" aria-label="Loading" />}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth(new Date(year, month + 1, 1))}
              aria-label="Next month"
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
            >
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-400">
            {WEEKDAYS.map((d) => (
              <span key={d} className="py-1">{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <span key={`blank-${i}`} />;
              const ymd = toYmd(new Date(year, month, day));
              const isPast = ymd < minYmd;
              const isFull = blockFullyBooked && fullSet.has(ymd);
              const isSelected = ymd === value;
              const isToday = ymd === todayYmd;
              const isDisabled = isPast || isFull || loadingMonth;
              return (
                <button
                  key={ymd}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => pick(ymd)}
                  aria-label={`${formatDisplay(ymd)}${isFull ? ', fully booked' : isPast ? ', unavailable' : ''}`}
                  aria-pressed={isSelected}
                  title={isFull ? 'Fully booked — every time is taken' : undefined}
                  className={`flex h-9 flex-col items-center justify-center rounded-lg text-sm leading-none transition-colors ${
                    isSelected
                      ? 'bg-blue-600 font-semibold text-white'
                      : isFull
                        ? 'cursor-not-allowed bg-red-50 text-red-400'
                        : isPast
                          ? 'cursor-not-allowed text-slate-300'
                          : `text-slate-700 hover:bg-blue-50 ${isToday ? 'ring-1 ring-blue-400 font-semibold' : ''}`
                  }`}
                >
                  <span className={isFull ? 'line-through' : ''}>{day}</span>
                  {isFull && <span className="mt-0.5 text-[8px] font-semibold uppercase no-underline">Full</span>}
                </button>
              );
            })}
          </div>

          {blockFullyBooked && (
            <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
              <span className="inline-block h-3 w-3 rounded bg-red-50 ring-1 ring-red-200" aria-hidden />
              Full: every time on that day is already booked
            </div>
          )}
          {booked?.error && booked.month === currentMonth && (
            <p className="mt-2 text-[11px] text-amber-700">Could not check booked days. Times are still checked when you pick one.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ServiceDatePicker;
