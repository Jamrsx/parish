import React from "react";

const BAR_WIDTHS = ["w-28", "w-36", "w-24", "w-20", "w-32", "w-16", "w-28", "w-24", "w-20"];

export const CashierTableSkeleton: React.FC<{ columns: number; rows?: number }> = ({
  columns,
  rows = 8,
}) => (
  <>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <tr key={`cashier-skel-row-${rowIndex}`} className="animate-pulse">
        {Array.from({ length: columns }).map((_, colIndex) => (
          <td key={`cashier-skel-col-${rowIndex}-${colIndex}`} className="px-4 py-3">
            <div className={`h-4 rounded bg-slate-200 ${BAR_WIDTHS[colIndex % BAR_WIDTHS.length]}`} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

export const CashierListSkeleton: React.FC<{ rows?: number; padded?: boolean }> = ({
  rows = 5,
  padded = true,
}) => (
  <>
    {Array.from({ length: rows }).map((_, index) => (
      <div
        key={`cashier-skel-list-${index}`}
        className={`flex justify-between gap-3 animate-pulse ${padded ? "px-5 py-3" : "px-4 py-3"}`}
      >
        <div className="space-y-2 flex-1 min-w-0">
          <div className="h-4 w-40 max-w-full rounded bg-slate-200" />
          <div className="h-3 w-28 max-w-full rounded bg-slate-200" />
        </div>
        <div className="h-4 w-16 rounded bg-slate-200 shrink-0 mt-1" />
      </div>
    ))}
  </>
);

export const CashierStatSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm animate-pulse">
    <div className="h-3 w-24 rounded bg-slate-200" />
    <div className="h-8 w-24 rounded bg-slate-200 mt-3" />
    <div className="h-3 w-32 rounded bg-slate-200 mt-2" />
  </div>
);
