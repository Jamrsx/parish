import { useEffect, useState } from 'react';
import { availabilityAPI } from '../../../../../library/Availability';

export function useBookedTimeSlots(date: string, excludeRequestId?: number) {
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date) {
      setBookedSlots([]);
      return;
    }

    let cancelled = false;

    const fetchBookedSlots = async () => {
      setLoading(true);
      console.log('Fetching booked time slots for date:', date, 'exclude:', excludeRequestId);

      try {
        const response = await availabilityAPI.getBookedTimeSlots(date, excludeRequestId);

        if (!cancelled) {
          if (response.success && response.data?.booked_times) {
            console.log('Booked time slots:', response.data.booked_times);
            setBookedSlots(response.data.booked_times);
          } else {
            setBookedSlots([]);
          }
        }
      } catch (error) {
        console.error('Error fetching booked time slots:', error);
        if (!cancelled) {
          setBookedSlots([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchBookedSlots();

    return () => {
      cancelled = true;
    };
  }, [date, excludeRequestId]);

  return { bookedSlots, loading };
}
