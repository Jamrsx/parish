import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

/** Under this many minutes left, the request is flagged as due soon. */
export const EXPIRY_WARN_MINUTES = 15;

export type ExpiryState = 'none' | 'ok' | 'soon' | 'overdue';

/** How close a pending request is to (or past) its response deadline. */
export const expiryState = (expiresAt: string | null | undefined, now: number): ExpiryState => {
  if (!expiresAt) return 'none';
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return 'none';
  const left = t - now;
  if (left <= 0) return 'overdue';
  return left <= EXPIRY_WARN_MINUTES * 60000 ? 'soon' : 'ok';
};

const clock = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const day = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const duration = (ms: number) => {
  const totalMin = Math.max(1, Math.ceil(ms / 60000));
  if (totalMin >= 1440) {
    const d = Math.floor(totalMin / 1440);
    const h = Math.floor((totalMin % 1440) / 60);
    return h ? `${d}d ${h}h` : `${d}d`;
  }
  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${totalMin} min`;
};

const STYLE: Record<Exclude<ExpiryState, 'none'>, { chip: string; sub: string; Icon: typeof Clock }> = {
  ok: { chip: 'border-slate-200 bg-slate-50 text-slate-700', sub: 'text-slate-500', Icon: Clock },
  soon: { chip: 'border-amber-300 bg-amber-100 text-amber-900', sub: 'text-amber-800', Icon: AlertTriangle },
  // Overdue flashes so the secretary acts on it (no flashing for users who prefer reduced motion)
  overdue: {
    chip: 'border-red-600 bg-red-600 text-white motion-safe:animate-pulse',
    sub: 'font-medium text-red-700',
    Icon: AlertTriangle,
  },
};

interface ExpiryIndicatorProps {
  /** ISO response deadline of the pending request; nothing shows when empty */
  expiresAt?: string | null;
}

/** Live countdown chip to a pending request's response deadline; flashes red once it is overdue. */
const ExpiryIndicator: React.FC<ExpiryIndicatorProps> = ({ expiresAt }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  const state = expiryState(expiresAt, now);
  if (state === 'none' || !expiresAt) return null;

  const target = new Date(expiresAt);
  const sameDay = new Date(now).toDateString() === target.toDateString();
  const at = sameDay ? clock(target) : `${day(target)}, ${clock(target)}`;
  const { chip, sub, Icon } = STYLE[state];
  const msLeft = target.getTime() - now;

  return (
    <div title={state === 'overdue' ? `Should have been answered by ${target.toLocaleString('en-US')}` : `Answer by ${target.toLocaleString('en-US')}`}>
      <span
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums ${chip}`}
        role={state === 'ok' ? undefined : 'status'}
      >
        <Icon size={13} aria-hidden />
        {state === 'overdue' ? `Overdue ${duration(-msLeft)}` : `${duration(msLeft)} left`}
      </span>
      <p className={`mt-1 whitespace-nowrap text-xs ${sub}`}>
        {state === 'overdue' ? `since ${at}` : `until ${at}`}
      </p>
    </div>
  );
};

export default ExpiryIndicator;
