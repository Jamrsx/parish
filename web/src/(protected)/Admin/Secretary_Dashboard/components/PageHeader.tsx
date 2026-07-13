import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  icon: Icon,
  action,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
      <div className="flex items-start gap-4">
        {Icon && (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <Icon size={24} aria-hidden />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-slate-500 sm:text-base">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

export default PageHeader;
