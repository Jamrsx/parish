import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import {
  formatHm,
  formatShortDate,
  priestScheduleAPI,
  type AssignmentConflict,
} from '../../../../../library/priestSchedule';

interface AssignmentConflictsAlertProps {
  /** Change this value to re-check (e.g. after time off is edited) */
  refreshKey?: number;
}

/** Upcoming services whose assigned priest is now on time off or switched off. */
const AssignmentConflictsAlert: React.FC<AssignmentConflictsAlertProps> = ({ refreshKey = 0 }) => {
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

  const shown = expanded ? items : items.slice(0, 3);

  const openRequest = (item: AssignmentConflict) => {
    console.log('[AssignmentConflicts] Open request', item.request_id, item.status);
    navigate(
      item.status === 'pending'
        ? `/admin/secretary/manage-requests?request=${item.request_id}`
        : '/admin/secretary/scheduled-services'
    );
  };

  return (
    <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900">
            Needs a new priest: {items.length} upcoming service{items.length === 1 ? '' : 's'}
          </p>
          <p className="text-xs text-amber-800">
            The assigned priest is no longer available at these times. Open each one and assign another priest.
          </p>
          <ul className="mt-2 divide-y divide-amber-200 rounded-lg border border-amber-200 bg-white">
            {shown.map((item) => (
              <li key={item.request_id}>
                <button
                  type="button"
                  onClick={() => openRequest(item)}
                  className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-amber-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {item.service_type} · {formatShortDate(item.date)}
                      {item.time ? ` ${formatHm(item.time)}` : ''}
                    </span>
                    <span className="block truncate text-xs text-slate-500">{item.problem}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-blue-700">Reassign →</span>
                </button>
              </li>
            ))}
          </ul>
          {items.length > 3 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:underline"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {expanded ? 'Show fewer' : `Show all ${items.length}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignmentConflictsAlert;
