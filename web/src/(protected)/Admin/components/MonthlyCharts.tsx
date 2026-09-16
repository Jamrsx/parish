import React from "react";

export const CHART_COLORS = [
  "#2563eb",
  "#0d9488",
  "#d97706",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#4f46e5",
  "#65a30d",
];

type Slice = {
  label: string;
  value: number;
  percentage: number;
};

type DonutChartProps = {
  slices: Slice[];
  centerLabel: string;
  centerValue: string;
  emptyMessage?: string;
};

const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
};

const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
};

export const DonutChart: React.FC<DonutChartProps> = ({
  slices,
  centerLabel,
  centerValue,
  emptyMessage = "No data for this month",
}) => {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) {
    return (
      <div className="h-52 flex items-center justify-center text-sm text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
        {emptyMessage}
      </div>
    );
  }

  const cx = 90;
  const cy = 90;
  const radius = 68;
  let angle = 0;

  const arcs = slices.map((slice, index) => {
    const sweep = (slice.value / total) * 360;
    const start = angle;
    const end = angle + Math.max(sweep, 0.01);
    angle = end;
    const isFullCircle = sweep >= 359.9;
    return {
      ...slice,
      path: isFullCircle ? "" : describeArc(cx, cy, radius, start, end),
      isFullCircle,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <svg viewBox="0 0 180 180" className="w-44 h-44 shrink-0">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#e2e8f0" strokeWidth="22" />
        {arcs.map((arc) =>
          arc.isFullCircle ? (
            <circle
              key={arc.label}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth="22"
            />
          ) : (
            <path
              key={arc.label}
              d={arc.path}
              fill="none"
              stroke={arc.color}
              strokeWidth="22"
              strokeLinecap="butt"
            />
          )
        )}
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 11 }}>
          {centerLabel}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-slate-900" style={{ fontSize: 13, fontWeight: 700 }}>
          {centerValue}
        </text>
      </svg>
      <ul className="w-full space-y-2">
        {arcs.map((arc) => (
          <li key={arc.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 min-w-0">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: arc.color }} />
              <span className="truncate text-slate-700">{arc.label}</span>
            </span>
            <span className="text-slate-600 font-medium whitespace-nowrap">{arc.percentage.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

type BarChartProps = {
  bars: Slice[];
  emptyMessage?: string;
  valueFormatter?: (value: number) => string;
};

export const HorizontalBarChart: React.FC<BarChartProps> = ({
  bars,
  emptyMessage = "No activity for this month",
  valueFormatter = (v) => String(v),
}) => {
  if (!bars.length || bars.every((b) => b.value <= 0)) {
    return (
      <div className="h-52 flex items-center justify-center text-sm text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
        {emptyMessage}
      </div>
    );
  }

  const max = Math.max(...bars.map((b) => b.value), 1);

  return (
    <div className="space-y-3">
      {bars.map((bar, index) => {
        const width = Math.max((bar.value / max) * 100, 4);
        const color = CHART_COLORS[index % CHART_COLORS.length];
        return (
          <div key={bar.label}>
            <div className="flex items-center justify-between gap-2 text-sm mb-1">
              <span className="text-slate-700 truncate">{bar.label}</span>
              <span className="text-slate-600 font-medium whitespace-nowrap">
                {valueFormatter(bar.value)} · {bar.percentage.toFixed(1)}%
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${width}%`, backgroundColor: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
