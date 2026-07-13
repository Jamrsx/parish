import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface SecretaryStatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  onClick?: () => void;
  highlight?: boolean;
}

const SecretaryStatCard: React.FC<SecretaryStatCardProps> = ({
  label,
  value,
  icon: Icon,
  onClick,
  highlight = false,
}) => {
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full rounded-xl border bg-white p-5 text-left shadow-sm transition-all ${
        highlight
          ? 'border-blue-300 ring-1 ring-blue-100'
          : 'border-slate-200 hover:border-blue-200 hover:shadow-md'
      } ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-blue-700">{value}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Icon size={22} aria-hidden />
        </div>
      </div>
    </Wrapper>
  );
};

export default SecretaryStatCard;
