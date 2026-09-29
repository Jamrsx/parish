import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronLeft,
  ChevronRight,
  Handshake,
  History,
  PackagePlus,
  Pencil,
  RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  InventoryHistoryAction,
  InventoryHistoryGroup,
  InventoryHistoryParams,
  InventoryHistoryResponse,
  InventoryHistoryRow,
  InventoryHistorySummary,
} from "../../../../library/inventory";
import { getCategoryInfo } from "../Secretary_Dashboard/components/inventoryCategories";

const PER_PAGE = 10;
const SEARCH_DEBOUNCE_MS = 400;
const COLUMN_COUNT = 7;

const EMPTY_SUMMARY: InventoryHistorySummary = {
  stock_in_qty: 0,
  stock_in_count: 0,
  stock_out_qty: 0,
  stock_out_count: 0,
  new_items: 0,
  borrowed: 0,
  returned: 0,
  edits: 0,
  total: 0,
};

const GROUP_BUTTONS: { key: InventoryHistoryGroup; label: string }[] = [
  { key: "all", label: "All" },
  { key: "stock_in", label: "Stock In" },
  { key: "stock_out", label: "Stock Out" },
  { key: "new", label: "New Items" },
  { key: "borrow", label: "Borrow & Return" },
  { key: "edits", label: "Edits" },
];

const ACTION_BADGE: Record<InventoryHistoryAction, string> = {
  created: "bg-violet-100 text-violet-800",
  stock_in: "bg-emerald-100 text-emerald-800",
  stock_out: "bg-orange-100 text-orange-800",
  borrowed: "bg-blue-100 text-blue-800",
  returned: "bg-teal-100 text-teal-800",
  returned_damaged: "bg-amber-100 text-amber-800",
  edited: "bg-slate-100 text-slate-700",
  deleted: "bg-red-100 text-red-700",
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }),
    time: date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }),
  };
};

const formatShortDate = (value?: string | null) =>
  value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : null;

const formatValue = (value: string | number | boolean | null, field: string) => {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "category") return getCategoryInfo(String(value)).label;
  if (field === "type") return value === "consumable" ? "Consumable" : "Item";
  return String(value);
};

type Fetcher = (params: InventoryHistoryParams) => Promise<{ data: InventoryHistoryResponse }>;

interface Props {
  fetcher: Fetcher;
  /** Increment to force a reload after inventory changes elsewhere on the page */
  refreshKey?: number;
  readOnlyNote?: string;
}

const SummaryCard: React.FC<{
  label: string;
  value: string;
  hint: string;
  Icon: LucideIcon;
  tone: string;
}> = ({ label, value, hint, Icon, tone }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-start justify-between gap-3">
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
      <p className="text-[11px] text-slate-400 mt-0.5 truncate">{hint}</p>
    </div>
    <span className={`shrink-0 p-2 rounded-lg ${tone}`}>
      <Icon size={18} />
    </span>
  </div>
);

const HistoryDetails: React.FC<{ row: InventoryHistoryRow }> = ({ row }) => {
  const d = row.details || {};
  const lines: React.ReactNode[] = [];

  if (row.action === "created") {
    const parts = [
      d.category ? getCategoryInfo(d.category).label : null,
      d.type ? (d.type === "consumable" ? "Consumable" : "Item") : null,
      d.is_borrowable ? "Borrowable" : null,
    ].filter(Boolean);
    if (parts.length) lines.push(parts.join(" · "));
  }

  if (row.action === "borrowed") {
    if (d.borrower_name) lines.push(<>Borrower: <span className="font-medium text-slate-800">{d.borrower_name}</span></>);
    const extra = [d.location ? `Location: ${d.location}` : null, d.expected_return_date ? `Due: ${formatShortDate(d.expected_return_date)}` : null].filter(Boolean);
    if (extra.length) lines.push(extra.join(" · "));
  }

  if (row.action === "returned" || row.action === "returned_damaged") {
    if (d.borrower_name) lines.push(<>Returned by: <span className="font-medium text-slate-800">{d.borrower_name}</span></>);
    if (row.action === "returned_damaged") {
      lines.push(
        <span className="text-amber-700">
          {d.quantity_damaged} of {d.quantity_borrowed} damaged (not restored)
          {d.damage_notes ? ` — ${d.damage_notes}` : ""}
        </span>
      );
    }
  }

  if (row.action === "edited" && d.changes?.length) {
    d.changes.forEach((change) => {
      lines.push(
        <>
          {change.label}: <span className="text-slate-500 line-through">{formatValue(change.from, change.field)}</span>{" "}
          → <span className="font-medium text-slate-800">{formatValue(change.to, change.field)}</span>
        </>
      );
    });
  }

  if (row.action === "deleted") lines.push("Item removed from inventory");
  if (row.notes) lines.push(<span className="italic text-slate-600">Note: {row.notes}</span>);

  if (lines.length === 0) return <span className="text-slate-400">—</span>;

  return (
    <div className="space-y-0.5 text-xs text-slate-600 break-words">
      {lines.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
      {d.source === "backfill" && (
        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-500">
          From borrower logs
        </span>
      )}
    </div>
  );
};

const InventoryHistoryPanel: React.FC<Props> = ({ fetcher, refreshKey = 0, readOnlyNote }) => {
  const [rows, setRows] = useState<InventoryHistoryRow[]>([]);
  const [summary, setSummary] = useState<InventoryHistorySummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<InventoryHistoryGroup>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, lastPage: 1, from: 0, to: 0 });
  const requestIdRef = useRef(0);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const next = search.trim();
    if (next === appliedSearch) return;
    const handle = setTimeout(() => {
      setAppliedSearch(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search, appliedSearch]);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const params: InventoryHistoryParams = {
      group,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      search: appliedSearch || undefined,
      per_page: PER_PAGE,
      page,
    };
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher(params);
      if (requestId !== requestIdRef.current) return;
      if (res.data?.success) {
        const data = res.data.data;
        const list = data?.data || [];
        setRows(list);
        setSummary(res.data.summary || EMPTY_SUMMARY);
        const lastPage = Math.max(1, data?.last_page ?? 1);
        setMeta({ total: data?.total ?? list.length, lastPage, from: data?.from ?? 0, to: data?.to ?? 0 });
        console.log("[InventoryHistory] Loaded:", { rows: list.length, total: data?.total, page, group, summary: res.data.summary });
        if (page > lastPage) setPage(lastPage);
      } else {
        setError(res.data?.message || "Could not load inventory history.");
      }
    } catch (err: unknown) {
      if (requestId !== requestIdRef.current) return;
      console.error("[InventoryHistory] Error:", err);
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || "Could not load inventory history.");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [fetcher, group, dateFrom, dateTo, appliedSearch, page]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const changeGroup = (next: InventoryHistoryGroup) => {
    console.log("[InventoryHistory] Filter group:", next);
    setGroup(next);
    setPage(1);
  };

  const goToPage = (next: number) => {
    const target = Math.min(Math.max(1, next), meta.lastPage);
    if (target === page) return;
    setPage(target);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const hasFilters = group !== "all" || !!dateFrom || !!dateTo || !!search.trim();

  const clearFilters = () => {
    console.log("[InventoryHistory] Clear filters");
    setGroup("all");
    setDateFrom("");
    setDateTo("");
    setSearch("");
    setAppliedSearch("");
    setPage(1);
  };

  const rangeHint = dateFrom || dateTo ? "In selected dates" : "All time";

  return (
    <div className="space-y-5">
      {readOnlyNote && (
        <div className="px-4 py-3 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-800">{readOnlyNote}</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard label="Stock In" value={`+${summary.stock_in_qty}`} hint={`${summary.stock_in_count} entries · ${rangeHint}`} Icon={ArrowDownCircle} tone="bg-emerald-50 text-emerald-600" />
        <SummaryCard label="Stock Out" value={`−${summary.stock_out_qty}`} hint={`${summary.stock_out_count} entries · ${rangeHint}`} Icon={ArrowUpCircle} tone="bg-orange-50 text-orange-600" />
        <SummaryCard label="New Items" value={String(summary.new_items)} hint={rangeHint} Icon={PackagePlus} tone="bg-violet-50 text-violet-600" />
        <SummaryCard label="Borrowed / Returned" value={`${summary.borrowed} / ${summary.returned}`} hint={rangeHint} Icon={Handshake} tone="bg-blue-50 text-blue-600" />
        <SummaryCard label="Edits" value={String(summary.edits)} hint={rangeHint} Icon={Pencil} tone="bg-slate-100 text-slate-600" />
      </div>

      <div ref={topRef} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3 scroll-mt-4">
        <div role="tablist" aria-label="Filter history by activity" className="flex flex-wrap gap-2">
          {GROUP_BUTTONS.map((btn) => {
            const active = group === btn.key;
            return (
              <button
                key={btn.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => changeGroup(btn.key)}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  active
                    ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                }`}
              >
                {btn.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setAppliedSearch(search.trim());
                setPage(1);
              }
            }}
            placeholder="Search item, borrower, or note..."
            aria-label="Search history"
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="From date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
            <span className="text-slate-400 text-sm">to</span>
            <input
              type="date"
              aria-label="To date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="text-xs text-blue-600 hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-blue-600 text-white">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Date &amp; Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Item</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Action</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide">Change</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Stock</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Details</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">By</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-slate-100 ${loading && rows.length > 0 ? "opacity-60" : ""}`}>
              {loading && rows.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`hist-skel-${i}`} className="animate-pulse">
                    {Array.from({ length: COLUMN_COUNT }).map((__, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-3 rounded bg-slate-200" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="py-14 text-center">
                    <History size={28} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-slate-600 font-medium">
                      {hasFilters ? "No history matches your filters" : "No inventory activity yet"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      New items, stock changes, borrows, returns and edits will appear here.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const when = formatDateTime(row.occurred_at);
                  const change = row.quantity_change;
                  const isBackfill = row.details?.source === "backfill";
                  return (
                    <tr key={row.history_id} className="align-top">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-slate-800">{when.date}</p>
                        <p className="text-xs text-slate-500">{when.time}</p>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{row.item_name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${ACTION_BADGE[row.action] || "bg-slate-100 text-slate-700"}`}>
                          {row.action_label}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${change > 0 ? "text-emerald-600" : change < 0 ? "text-red-600" : "text-slate-400"}`}>
                        {change > 0 ? `+${change}` : change < 0 ? `−${Math.abs(change)}` : "0"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                        {row.quantity_before !== null && row.quantity_after !== null ? (
                          <>
                            {row.quantity_before} <span className="text-slate-400">→</span>{" "}
                            <span className="font-semibold">{row.quantity_after}</span>
                          </>
                        ) : row.quantity_before !== null ? (
                          <span>{row.quantity_before}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[18rem]">
                        <HistoryDetails row={row} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                        {row.performed_by || (isBackfill ? <span className="text-slate-400">—</span> : "System")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {meta.total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/60">
            <p className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-700">{meta.from}</span>–
              <span className="font-medium text-slate-700">{meta.to}</span> of{" "}
              <span className="font-medium text-slate-700">{meta.total}</span> record{meta.total === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              <span className="text-sm text-slate-600 px-2">
                Page {page} of {meta.lastPage}
              </span>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= meta.lastPage || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryHistoryPanel;
