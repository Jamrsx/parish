import React from 'react';
import { Ban, CheckCircle2, CircleDashed, CircleCheck } from 'lucide-react';

type RequestStatus = 'pending' | 'approved' | 'done' | 'cancelled';

const STATUS_STYLES: Record<RequestStatus, string> = {
  pending: 'bg-blue-50 text-blue-700 border-blue-200',
  approved: 'bg-blue-100 text-blue-800 border-blue-300',
  done: 'bg-blue-600 text-white border-blue-600',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_ICONS: Record<RequestStatus, React.ReactNode> = {
  pending: <CircleDashed size={12} />,
  approved: <CheckCircle2 size={12} />,
  done: <CircleCheck size={12} />,
  cancelled: <Ban size={12} />,
};

interface StatusBadgeProps {
  status: RequestStatus | string;
  label?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const key = status as RequestStatus;
  const styles = STATUS_STYLES[key] || 'bg-slate-100 text-slate-600 border-slate-200';
  const icon = STATUS_ICONS[key];
  const text = label || status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles}`}
    >
      {icon}
      {text}
    </span>
  );
};

export default StatusBadge;
