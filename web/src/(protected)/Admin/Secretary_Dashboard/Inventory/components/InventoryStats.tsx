import React from "react";
import { Package, CheckCircle, AlertTriangle, Handshake, Clock, RotateCcw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getCategoryInfo } from "../../components/inventoryCategories";

interface InventoryStatsProps {
  stats: {
    total: number;
    available: number;
    outOfStock: number;
    borrowed: number;
    overdue: number;
    returned: number;
    category_counts?: Record<string, number>;
  };
}

const statItems: { key: keyof InventoryStatsProps["stats"]; label: string; icon: LucideIcon }[] = [
  { key: "total", label: "Total Items", icon: Package },
  { key: "available", label: "Available", icon: CheckCircle },
  { key: "outOfStock", label: "Out of Stock", icon: AlertTriangle },
  { key: "borrowed", label: "Borrowed", icon: Handshake },
  { key: "overdue", label: "Overdue", icon: Clock },
  { key: "returned", label: "Returned", icon: RotateCcw },
];

const InventoryStats: React.FC<InventoryStatsProps> = ({ stats }) => {
  return (
    <div className="mb-8 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statItems.map(({ key, label, icon: Icon }) => (
          <div
            key={key}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-medium text-slate-500">{label}</div>
                <div className="text-2xl font-bold text-blue-700 mt-1">
                  {stats[key] as number}
                </div>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Icon size={18} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {stats.category_counts && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Object.entries(stats.category_counts).map(([category, count]) => {
            const info = getCategoryInfo(category);
            const CategoryIcon = info.Icon;
            return (
              <div
                key={category}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <CategoryIcon size={18} />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">{info.label}</div>
                    <div className="text-xl font-bold text-blue-700">{count}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InventoryStats;
