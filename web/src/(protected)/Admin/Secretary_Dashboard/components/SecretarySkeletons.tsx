import React from "react";

const BAR_WIDTHS = ["w-28", "w-36", "w-24", "w-20", "w-32", "w-16", "w-28", "w-24", "w-20"];

export const SecretaryTableSkeleton: React.FC<{ columns: number; rows?: number }> = ({
  columns,
  rows = 8,
}) => (
  <>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <tr key={`sec-skel-row-${rowIndex}`} className="animate-pulse">
        {Array.from({ length: columns }).map((_, colIndex) => (
          <td key={`sec-skel-col-${rowIndex}-${colIndex}`} className="px-4 py-3">
            <div className={`h-4 rounded bg-slate-200 ${BAR_WIDTHS[colIndex % BAR_WIDTHS.length]}`} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

export const SecretaryListSkeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => (
  <>
    {Array.from({ length: rows }).map((_, index) => (
      <div key={`sec-skel-list-${index}`} className="px-6 py-4 flex justify-between gap-3 animate-pulse">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-slate-200 shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-40 max-w-full rounded bg-slate-200" />
            <div className="h-3 w-28 max-w-full rounded bg-slate-200" />
          </div>
        </div>
        <div className="h-4 w-16 rounded bg-slate-200 shrink-0 mt-3" />
      </div>
    ))}
  </>
);

export const SecretaryPersonListSkeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => (
  <>
    {Array.from({ length: rows }).map((_, index) => (
      <div key={`sec-skel-person-${index}`} className="px-6 py-4 flex items-center gap-4 animate-pulse">
        <div className="h-10 w-10 rounded-full bg-slate-200 shrink-0" />
        <div className="flex-1 space-y-2 min-w-0">
          <div className="h-4 w-40 max-w-full rounded bg-slate-200" />
          <div className="h-3 w-56 max-w-full rounded bg-slate-200" />
        </div>
        <div className="h-8 w-20 rounded-lg bg-slate-200 shrink-0" />
      </div>
    ))}
  </>
);

export const SecretaryStatSkeleton: React.FC = () => (
  <div className="w-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="h-3 w-24 rounded bg-slate-200" />
        <div className="mt-3 h-8 w-16 rounded bg-slate-200" />
      </div>
      <div className="h-11 w-11 rounded-lg bg-slate-200 shrink-0" />
    </div>
  </div>
);

export const SecretaryCalendarSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
    <div className="grid grid-cols-7">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
        <div key={day} className="text-center text-xs font-semibold text-gray-500 py-3 bg-gray-50">
          {day}
        </div>
      ))}
      {Array.from({ length: 35 }).map((_, index) => (
        <div key={`cal-skel-${index}`} className="h-28 border border-slate-100 p-2 animate-pulse">
          <div className="h-3 w-6 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-full rounded bg-slate-100" />
          <div className="mt-2 h-3 w-2/3 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  </div>
);
