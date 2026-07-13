import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface FilterPillProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: LucideIcon;
}

const FilterPill: React.FC<FilterPillProps> = ({ label, active, onClick, icon: Icon }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
        active
          ? 'bg-blue-600 text-white shadow-sm'
          : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
      }`}
    >
      {Icon && <Icon size={16} aria-hidden />}
      {label}
    </button>
  );
};

export default FilterPill;
