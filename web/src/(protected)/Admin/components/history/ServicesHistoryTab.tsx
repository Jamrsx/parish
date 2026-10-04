import React, { useEffect, useMemo, useState } from "react";
import { ChevronRight, RefreshCw, Search } from "lucide-react";
import {
  historyAPI,
  formatClock,
  formatDay,
  formatPeso,
  SERVICE_STATUS_LABELS,
  type HistoryScope,
  type ServiceHistoryRow,
  type ServiceStatus,
} from "../../../../../library/history";
import HistoryPagination, { type PageMeta } from "./HistoryPagination";
import ServiceTimelineModal from "./ServiceTimelineModal";

const PER_PAGE = 15;
const SEARCH_DEBOUNCE_MS = 400;

const STATUS_STYLES: Record<ServiceStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-blue-50 text-blue-700 border-blue-200",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

const PAYMENT_STYLES: Record<ServiceHistoryRow["payment_status"], string> = {
  paid: "text-emerald-700",
  partial: "text-amber-700",
  unpaid: "text-slate-500",
};

interface FetchResult {
  key: string;
  rows: ServiceHistoryRow[];
  meta: PageMeta;
  counts: Record<ServiceStatus, number> | null;
  error: string | null;
}

const ServicesHistoryTab: React.FC<{ scope: HistoryScope }> = ({ scope }) => {
  const api = useMemo(() => historyAPI(scope), [scope]);
  const [status, setStatus] = useState<ServiceStatus | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<FetchResult | null>(null);
  const [openRequestId, setOpenRequestId] = useState<number | null>(null);

  useEffect(() => {
    const next = search.trim();
    if (next === appliedSearch) return;
    const handle = setTimeout(() => {
      setAppliedSearch(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search, appliedSearch]);

  const params = useMemo(
    () => ({
      status: status || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      search: appliedSearch || undefined,
      page,
      per_page: PER_PAGE,
    }),
    [status, dateFrom, dateTo, appliedSearch, page]
  );
  const requestKey = `${JSON.stringify(params)}#${nonce}`;

  useEffect(() => {
    let cancelled = false;
    console.log("[History:Services] Fetching", params);
    api
      .services(params)
      .then((res) => {
        if (cancelled) return;
        const data = res.data.data;
        console.log("[History:Services] Loaded", { total: data.total, page: data.current_page });
        setResult({
          key: requestKey,
          rows: data.data,
          meta: { total: data.total, lastPage: Math.max(1, data.last_page), from: data.from ?? 0, to: data.to ?? 0 },
          counts: res.data.status_counts,
          error: null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[History:Services] Error", err);
        setResult((prev) => ({
          key: requestKey,
          rows: prev?.rows ?? [],
          meta: prev?.meta ?? { total: 0, lastPage: 1, from: 0, to: 0 },
          counts: prev?.counts ?? null,
          error: err?.response?.data?.message || "Could not load the service history. Please try again.",
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [api, params, requestKey]);

  const loading = result?.key !== requestKey;
  const rows = result?.rows ?? [];
  const meta = result?.meta ?? { total: 0, lastPage: 1, from: 0, to: 0 };
  const counts = result?.counts;
  const hasFilters = !!(status || dateFrom || dateTo || search.trim());

  const clearFilters = () => {
    console.log("[History:Services] Clear filters");
    setStatus("");
    setDateFrom("");
    setDateTo("");
    setSearch("");
    setAppliedSearch("");
    setPage(1);
  };

  const statusPills: { value: ServiceStatus | ""; label: string; count?: number }[] = [
    { value: "", label: "All", count: counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined },
    ...(Object.keys(SERVICE_STATUS_LABELS) as ServiceStatus[]).map((s) => ({
      value: s,
      label: SERVICE_STATUS_LABELS[s],
      count: counts?.[s],
    })),
  ];

  return (
    <div>
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, service or reference (e.g. REQ-000012)"
            aria-label="Search services"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-slate-600">
            <span>From</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-1.5 text-sm text-slate-600">
            <span>To</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => setNonce((n) => n + 1)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {statusPills.map((pill) => {
          const active = status === pill.value;
          return (
            <button
              key={pill.value || "all"}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setStatus(pill.value);
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {pill.label}
              {pill.count !== undefined && <span className="ml-1 opacity-75">{pill.count}</span>}
            </button>
          );
        })}
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="ml-1 text-xs text-blue-600 hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {result?.error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left">Service date</th>
                <th className="px-4 py-3 text-left">Reference</th>
                <th className="px-4 py-3 text-left">Service</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Priest</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Payment</th>
                <th className="px-4 py-3 text-right">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-slate-100 ${loading && rows.length > 0 ? "opacity-60" : ""}`}>
              {loading && rows.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`skel-${i}`}>
                    <td colSpan={8} className="px-4 py-3">
                      <div className="h-4 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-slate-500">
                    {hasFilters ? "No services match your filters." : "No service requests yet."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.request_id}
                    onClick={() => setOpenRequestId(row.request_id)}
                    className="cursor-pointer hover:bg-blue-50/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {formatDay(row.preferred_date)}
                      {row.preferred_time && <span className="text-slate-400"> · {formatClock(row.preferred_time)}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500">{row.reference}</td>
                    <td className="px-4 py-3 text-slate-800">
                      {row.service_type}
                      {row.was_rescheduled && (
                        <span className="ml-1.5 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                          Rescheduled
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.client_name || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{row.assigned_priest || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[row.status]}`}>
                        {SERVICE_STATUS_LABELS[row.status]}
                      </span>
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 text-xs font-semibold ${PAYMENT_STYLES[row.payment_status]}`}>
                      {row.fee > 0 ? `${formatPeso(row.amount_paid)} / ${formatPeso(row.fee)}` : "No fee"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenRequestId(row.request_id);
                        }}
                        className="inline-flex items-center gap-0.5 text-xs font-semibold text-blue-600 hover:underline"
                        aria-label={`View history of ${row.reference}`}
                      >
                        History
                        <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <HistoryPagination
          page={page}
          meta={meta}
          noun="service"
          loading={loading}
          onPage={(next) => setPage(Math.min(Math.max(1, next), meta.lastPage))}
        />
      </div>

      {openRequestId !== null && (
        <ServiceTimelineModal scope={scope} requestId={openRequestId} onClose={() => setOpenRequestId(null)} />
      )}
    </div>
  );
};

export default ServicesHistoryTab;
