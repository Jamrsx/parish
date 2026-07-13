import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon = Inbox,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-400">
        <Icon size={28} aria-hidden />
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      )}
    </div>
  );
};

export default EmptyState;
