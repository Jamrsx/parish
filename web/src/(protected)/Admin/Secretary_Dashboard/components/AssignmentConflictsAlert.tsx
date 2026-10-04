import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { formatHm, formatShortDate, priestScheduleAPI, type AssignmentConflict } from '../../../../../library/priestSchedule';

interface AssignmentConflictsAlertProps {
  /** Change this number to refetch (e.g. after time off is added) */
  refreshKey?: number;
  className?: string;
}

/**
 * Upcoming services whose assigned priest is now off at that date/time.
 * Renders nothing when there are none.
 */
const AssignmentConflictsAlert: React.FC<AssignmentConflictsAlertProps> = ({ refreshKey = 0, className = '' }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<AssignmentConflict[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await priestScheduleAPI.getAssignmentConflicts();
        console.log('[AssignmentConflicts] Loaded', res.data?.data);
        if (!cancelled && res.data?.success) setItems(res.data.data.items || []);
      } catch (err) {
        console.error('[AssignmentConflicts] Load failed', err);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (items.length === 0) return null;

  const openRequest = (item: AssignmentConflict) => {
    console.log('[AssignmentConflicts] Open request', item.request_id, item.status);
    navigate(
      item.status === 'pending'
        ? `/admin/secretary/manage-requests?request=${item.request_id}`
        : '/admin/secretary/scheduled-services'
    );
  };

  return (
    <div role="alert" className={`rounded-xl border border-amber-300 bg-amber-50 ${className}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-start gap-2 text-sm text-amber-900">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>
            <strong>Needs a new priest:</strong> {items.length} upcoming service{items.length === 1 ? '' : 's'}{' '}
            {items.length === 1 ? 'has' : 'have'} a priest who is now off at that time.
          </span>
        </span>
        {expanded ? <ChevronUp size={18} className="shrink-0 text-amber-800" /> : <ChevronDown size={18} className="shrink-0 text-amber-800" />}
      </button>
      {expanded && (
        <ul className="divide-y divide-amber-200 border-t border-amber-200">
          {items.map((item) => (
            <li key={item.request_id} className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-slate-800">
                  {item.service_type} · {formatShortDate(item.date)}
                  {item.time ? ` · ${formatHm(item.time)}` : ''}
                </p>
                <p className="text-xs text-amber-900">{item.problem}</p>
              </div>
              <button
                type="button"
                onClick={() => openRequest(item)}
                className="shrink-0 self-start rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
              >
                Reassign priest
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AssignmentConflictsAlert;
