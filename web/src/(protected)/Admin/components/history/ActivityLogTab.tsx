import React, { useEffect, useMemo, useState } from "react";
import { Info, RefreshCw, Search } from "lucide-react";
import {
  historyAPI,
  formatDateTime,
  formatPeso,
  type ActivityLogEntry,
  type HistoryScope,
} from "../../../../../library/history";
import HistoryPagination, { type PageMeta } from "./HistoryPagination";

const PER_PAGE = 25;
const SEARCH_DEBOUNCE_MS = 400;

const ACTION_LABELS: Record<string, string> = {
  created: "Added",
  updated: "Edited",
  status_changed: "Status",
  rescheduled: "Rescheduled",
  priest_assigned: "Priest",
  paid: "Payment",
  deleted: "Deleted",
};

const ACTION_STYLES: Record<string, string> = {
  created: "bg-slate-100 text-slate-700",
  updated: "bg-amber-50 text-amber-700",
  status_changed: "bg-blue-50 text-blue-700",
  rescheduled: "bg-violet-50 text-violet-700",
  priest_assigned: "bg-indigo-50 text-indigo-700",
  paid: "bg-emerald-50 text-emerald-700",
  deleted: "bg-red-50 text-red-700",
};

const ROLE_LABELS: Record<string, string> = {
  secretary: "Secretary",
  cashier: "Cashier",
  priest: "Priest",
  parishioner: "Parishioner",
};

interface FetchResult {
  key: string;
  rows: ActivityLogEntry[];
  meta: PageMeta;
  startedAt: string | null;
  subjectTypes: Record<string, string>;
  error: string | null;
}

const ActivityLogTab: React.FC<{ scope: HistoryScope }> = ({ scope }) => {
  const api = useMemo(() => historyAPI(scope), [scope]);
  const [subjectType, setSubjectType] = useState("");
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<FetchResult | null>(null);

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
      subject_type: subjectType || undefined,
      action: action || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      search: appliedSearch || undefined,
      page,
      per_page: PER_PAGE,
    }),
    [subjectType, action, dateFrom, dateTo, appliedSearch, page]
  );
  const requestKey = `${JSON.stringify(params)}#${nonce}`;

  useEffect(() => {
    let cancelled = false;
    console.log("[History:Activity] Fetching", params);
    api
      .activity(params)
      .then((res) => {
        if (cancelled) return;
        const data = res.data.data;
        console.log("[History:Activity] Loaded", { total: data.total, startedAt: res.data.started_at });
        setResult({
          key: requestKey,
          rows: data.data,
          meta: { total: data.total, lastPage: Math.max(1, data.last_page), from: data.from ?? 0, to: data.to ?? 0 },
          startedAt: res.data.started_at,
          subjectTypes: res.data.subject_types || {},
          error: null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[History:Activity] Error", err);
        setResult((prev) => ({
          key: requestKey,
          rows: prev?.rows ?? [],
          meta: prev?.meta ?? { total: 0, lastPage: 1, from: 0, to: 0 },
          startedAt: prev?.startedAt ?? null,
          subjectTypes: prev?.subjectTypes ?? {},
          error: err?.response?.data?.message || "Could not load the activity log. Please try again.",
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [api, params, requestKey]);

  const loading = result?.key !== requestKey;
  const rows = result?.rows ?? [];
  const meta = result?.meta ?? { total: 0, lastPage: 1, from: 0, to: 0 };
  const hasFilters = !!(subjectType || action || dateFrom || dateTo || search.trim());

  const clearFilters = () => {
    console.log("[History:Activity] Clear filters");
    setSubjectType("");
    setAction("");
    setDateFrom("");
    setDateTo("");
    setSearch("");
    setAppliedSearch("");
    setPage(1);
  };

  return (
    <div>
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
        <p>
          Every addition, status change, edit and deletion is recorded here automatically, with the person who did it.
          {result?.startedAt
            ? ` Recording started on ${formatDateTime(result.startedAt)}; earlier service events still appear in each service's history.`
            : " Entries will appear here as soon as records are added or changed."}
        </p>
      </div>

      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search what happened or who did it"
            aria-label="Search activity"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={subjectType}
          onChange={(e) => {
            setSubjectType(e.target.value);
            setPage(1);
          }}
          aria-label="Record type"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All records</option>
          {Object.entries(result?.subjectTypes ?? {}).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          aria-label="Action"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All actions</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            aria-label="From date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
          />
          <input
            type="date"
            aria-label="To date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
          />
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
      <div className="mb-3 h-5">
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="text-xs text-blue-600 hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {result?.error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ul className={`divide-y divide-slate-100 ${loading && rows.length > 0 ? "opacity-60" : ""}`}>
          {loading && rows.length === 0 ? (
            Array.from({ length: 8 }).map((_, i) => (
              <li key={`skel-${i}`} className="px-4 py-3">
                <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-slate-100" />
              </li>
            ))
          ) : rows.length === 0 ? (
            <li className="py-14 text-center text-sm text-slate-500">
              {hasFilters ? "No activity matches your filters." : "No activity recorded yet."}
            </li>
          ) : (
            rows.map((row) => (
              <li key={row.log_id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
                <time className="shrink-0 text-xs text-slate-500 sm:w-40 sm:pt-0.5">{formatDateTime(row.created_at)}</time>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">
                    <span
                      className={`mr-2 inline-block rounded px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase ${
                        ACTION_STYLES[row.action] ?? "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {ACTION_LABELS[row.action] ?? row.action}
                    </span>
                    {row.description}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {row.subject_label} · by <span className="font-medium text-slate-700">{row.user_name}</span>
                    {row.user_role && ` (${ROLE_LABELS[row.user_role] ?? row.user_role})`}
                  </p>
                </div>
                {row.amount !== null && (
                  <span className="shrink-0 text-sm font-semibold text-slate-700">{formatPeso(row.amount)}</span>
                )}
              </li>
            ))
          )}
        </ul>
        <HistoryPagination
          page={page}
          meta={meta}
          noun="entry"
          pluralNoun="entries"
          loading={loading}
          onPage={(next) => setPage(Math.min(Math.max(1, next), meta.lastPage))}
        />
      </div>
    </div>
  );
};

export default ActivityLogTab;
