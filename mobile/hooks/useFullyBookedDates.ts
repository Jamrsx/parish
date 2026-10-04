import { useEffect, useState } from 'react';
import { api } from '../library/api';
import { toDateString } from '../constants/serviceTimeOptions';

const CACHE_TTL_MS = 60_000;
const monthCache = new Map<string, { dates: string[]; fetchedAt: number }>();

export function useFullyBookedDates(visibleMonth: Date, enabled: boolean = true) {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const [fullyBookedDates, setFullyBookedDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setFullyBookedDates([]);
      setLoading(false);
      return;
    }

    const cached = monthCache.get(monthKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      setFullyBookedDates(cached.dates);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const from = toDateString(year, month, 1);
    const to = toDateString(year, month, new Date(year, month + 1, 0).getDate());

    const fetchMonth = async () => {
      setLoading(true);
      console.log('Fetching fully booked dates:', { from, to });
      try {
        const response = await api.getFullyBookedDates(from, to);
        const dates = response.success ? response.data?.fully_booked_dates ?? [] : [];
        console.log('Fully booked dates for', monthKey, dates);
        monthCache.set(monthKey, { dates, fetchedAt: Date.now() });
        if (!cancelled) setFullyBookedDates(dates);
      } catch (error) {
        console.error('Error fetching fully booked dates:', error);
        if (!cancelled) setFullyBookedDates([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchMonth();

    return () => {
      cancelled = true;
    };
  }, [monthKey, year, month, enabled]);

  return { fullyBookedDates, loading };
}
