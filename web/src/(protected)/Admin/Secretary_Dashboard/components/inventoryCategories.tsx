import { Building2, Church, Clipboard, Monitor, Package } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface CategoryInfo {
  label: string;
  Icon: LucideIcon;
  badgeClass: string;
}

export const INVENTORY_CATEGORIES: Record<string, CategoryInfo> = {
  sacristy: {
    label: 'Sacristy Items',
    Icon: Church,
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  church: {
    label: 'Church Items',
    Icon: Building2,
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  office_supply: {
    label: 'Office Supply',
    Icon: Clipboard,
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  office_equipment: {
    label: 'Office Equipment',
    Icon: Monitor,
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

export function getCategoryInfo(category: string): CategoryInfo {
  return (
    INVENTORY_CATEGORIES[category] || {
      label: category,
      Icon: Package,
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    }
  );
}

export const CATEGORY_OPTIONS = [
  { value: 'sacristy', label: 'Sacristy Items' },
  { value: 'church', label: 'Church Items' },
  { value: 'office_supply', label: 'Office Supply' },
  { value: 'office_equipment', label: 'Office Equipment' },
] as const;
