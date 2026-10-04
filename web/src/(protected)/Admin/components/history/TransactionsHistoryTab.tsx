import React, { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, Loader2, RefreshCw, Search } from "lucide-react";
import {
  historyAPI,
  formatDateTime,
  formatPeso,
  toYmd,
  TRANSACTION_TYPE_LABELS,
  type HistoryScope,
  type LedgerEntry,
  type LedgerSummary,
  type TransactionType,
} from "../../../../../library/history";
import { downloadTransactionsPdf } from "../../../../../library/historyPdf";
import HistoryPagination, { type PageMeta } from "./HistoryPagination";

const PER_PAGE = 25;
const SEARCH_DEBOUNCE_MS = 400;

type Preset = "this_month" | "last_month" | "this_year" | "custom";
type Direction = "all" | "in" | "out";

const presetRange = (preset: Exclude<Preset, "custom">): { from: string; to: string } => {
  const now = new Date();
  if (preset === "last_month") {
    return {
      from: toYmd(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: toYmd(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  if (preset === "this_year") {
    return { from: toYmd(new Date(now.getFullYear(), 0, 1)), to: toYmd(now) };
  }
  return { from: toYmd(new Date(now.getFullYear(), now.getMonth(), 1)), to: toYmd(now) };
};

interface FetchResult {
  key: string;
  rows: LedgerEntry[];
  meta: PageMeta;
  summary: LedgerSummary | null;
  error: string | null;
}

const TransactionsHistoryTab: React.FC<{ scope: HistoryScope }> = ({ scope }) => {
  const api = useMemo(() => historyAPI(scope), [scope]);
  const initial = presetRange("this_month");
  const [preset, setPreset] = useState<Preset>("this_month");
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [direction, setDirection] = useState<Direction>("all");
  const [type, setType] = useState<TransactionType | "">("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<FetchResult | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    const next = search.trim();
    if (next === appliedSearch) return;
    const handle = setTimeout(() => {
      setAppliedSearch(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search, appliedSearch]);

  const rangeError = !dateFrom || !dateTo ? "Choose both a start and an end date." : dateFrom > dateTo ? "The start date must be on or before the end date." : null;

  const filters = useMemo(
    () => ({
      date_from: dateFrom,
      date_to: dateTo,
      direction,
      type: type || undefined,
      search: appliedSearch || undefined,
    }),
    [dateFrom, dateTo, direction, type, appliedSearch]
  );
  const params = useMemo(() => ({ ...filters, page, per_page: PER_PAGE }), [filters, page]);
  const requestKey = `${JSON.stringify(params)}#${nonce}`;

  useEffect(() => {
    if (rangeError) return;
    let cancelled = false;
    console.log("[History:Transactions] Fetching", params);
    api
      .transactions(params)
      .then((res) => {
        if (cancelled) return;
        const data = res.data.data;
        console.log("[History:Transactions] Loaded", { total: data.total, summary: res.data.summary });
        setResult({
          key: requestKey,
          rows: data.data,
          meta: { total: data.total, lastPage: Math.max(1, data.last_page), from: data.from ?? 0, to: data.to ?? 0 },
          summary: res.data.summary,
          error: null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[History:Transactions] Error", err);
        setResult((prev) => ({
          key: requestKey,
          rows: prev?.rows ?? [],
          meta: prev?.meta ?? { total: 0, lastPage: 1, from: 0, to: 0 },
          summary: prev?.summary ?? null,
          error: err?.response?.data?.message || "Could not load church transactions. Please try again.",
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [api, params, requestKey, rangeError]);

  const loading = !rangeError && result?.key !== requestKey;
  const rows = result?.rows ?? [];
  const meta = result?.meta ?? { total: 0, lastPage: 1, from: 0, to: 0 };
  const summary = result?.summary ?? null;
  const filtersActive = direction !== "all" || !!type || !!search.trim();

  const choosePreset = (next: Preset) => {
    console.log("[History:Transactions] Period preset", next);
    setPreset(next);
    if (next !== "custom") {
      const r = presetRange(next);
      setDateFrom(r.from);
      setDateTo(r.to);
    }
    setPage(1);
  };

  const filterNote = () => {
    const parts: string[] = [];
    if (direction === "in") parts.push("money in only");
    if (direction === "out") parts.push("money out only");
    if (type) parts.push(TRANSACTION_TYPE_LABELS[type]);
    if (appliedSearch) parts.push(`search "${appliedSearch}"`);
    return parts.length ? parts.join(", ") : null;
  };

  const handleDownload = async () => {
    if (rangeError) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      console.log("[History:Transactions] Download PDF", filters);
      const res = await api.allTransactions(filters);
      const { items, total } = res.data.data;
      if (total > items.length) {
        console.warn(`[History:Transactions] PDF limited to ${items.length} of ${total} rows`);
      }
      await downloadTransactionsPdf(res.data.summary, items, filterNote());
    } catch (err) {
      console.error("[History:Transactions] PDF error", err);
      setDownloadError("The PDF could not be created. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const presets: { id: Preset; label: string }[] = [
    { id: "this_month", label: "This month" },
    { id: "last_month", label: "Last month" },
    { id: "this_year", label: "This year" },
    { id: "custom", label: "Custom" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={preset === p.id}
              onClick={() => choosePreset(p.id)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                preset === p.id ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p.label}
            </button>
          ))}
          <label className="ml-1 flex items-center gap-1.5 text-sm text-slate-600">
            <span>From</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPreset("custom");
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
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
                setPreset("custom");
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNonce((n) => n + 1)}
            disabled={loading || !!rangeError}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading || !!rangeError || meta.total === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {downloading ? "Preparing PDF…" : "Download PDF"}
          </button>
        </div>
      </div>

      {rangeError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{rangeError}</div>
      )}
      {(result?.error || downloadError) && !rangeError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {downloadError || result?.error}
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryCard label="Money in" value={summary?.income_total} tone="text-emerald-700" loading={!summary} />
        <SummaryCard
          label={`Church share${summary ? ` (${summary.sharing.church_percent}%)` : ""}`}
          value={summary?.sharing.church_amount}
          tone="text-blue-700"
          loading={!summary}
        />
        <SummaryCard
          label={`Archdiocese${summary ? ` (${summary.sharing.archdiocese_percent}%)` : ""}`}
          value={summary?.sharing.archdiocese_amount}
          tone="text-slate-700"
          note="To be remitted"
          loading={!summary}
        />
        <SummaryCard label="Money out" value={summary?.expense_total} tone="text-red-700" note="Verified expenses" loading={!summary} />
        <SummaryCard
          label={summary && summary.church_net < 0 ? "Church shortfall" : "Church net"}
          value={summary?.church_net}
          tone={summary && summary.church_net < 0 ? "text-red-700" : "text-slate-900"}
          note="Church share minus expenses"
          loading={!summary}
        />
      </div>

      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Direction">
          {(
            [
              { id: "all", label: "All" },
              { id: "in", label: "Money in" },
              { id: "out", label: "Money out" },
            ] as { id: Direction; label: string }[]
          ).map((d) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={direction === d.id}
              onClick={() => {
                setDirection(d.id);
                if (d.id === "out" && type && type !== "expense") setType("");
                if (d.id === "in" && type === "expense") setType("");
                setPage(1);
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                direction === d.id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <select
          value={type}
          onChange={(e) => {
            const next = e.target.value as TransactionType | "";
            setType(next);
            if (next === "expense") setDirection("out");
            else if (next) setDirection("in");
            setPage(1);
          }}
          aria-label="Transaction type"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          {(Object.keys(TRANSACTION_TYPE_LABELS) as TransactionType[]).map((t) => (
            <option key={t} value={t}>
              {TRANSACTION_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description, name, OR number or staff"
            aria-label="Search transactions"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {filtersActive && (
          <button
            type="button"
            onClick={() => {
              setDirection("all");
              setType("");
              setSearch("");
              setAppliedSearch("");
              setPage(1);
            }}
            className="text-xs text-blue-600 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">OR / Ref</th>
                <th className="px-4 py-3 text-right">In</th>
                <th className="px-4 py-3 text-right">Out</th>
                <th className="px-4 py-3 text-left">Recorded by</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-slate-100 ${loading && rows.length > 0 ? "opacity-60" : ""}`}>
              {loading && rows.length === 0 ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`skel-${i}`}>
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-4 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-slate-500">
                    {filtersActive ? "No transactions match your filters." : "No transactions in this period."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.key}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(row.date_time)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold ${
                          row.direction === "in" ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {row.direction === "in" ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                        {row.type_label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-800">{row.description}</p>
                      {row.party && <p className="text-xs text-slate-500">{row.party}</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500">{row.reference || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-emerald-700">
                      {row.amount_in ? formatPeso(row.amount_in) : ""}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-red-700">
                      {row.amount_out ? formatPeso(row.amount_out) : ""}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.recorded_by || "—"}
                      {row.approved_by && row.approved_by !== row.recorded_by && (
                        <p className="text-xs text-slate-400">checked by {row.approved_by}</p>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {summary && rows.length > 0 && filtersActive && (
              <tfoot className="bg-slate-50 text-sm font-semibold">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right text-slate-600">
                    Total of matching entries
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-700">{formatPeso(summary.filtered_in)}</td>
                  <td className="px-4 py-3 text-right text-red-700">{formatPeso(summary.filtered_out)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <HistoryPagination
          page={page}
          meta={meta}
          noun="transaction"
          loading={loading}
          onPage={(next) => setPage(Math.min(Math.max(1, next), meta.lastPage))}
        />
      </div>
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value?: number; tone: string; note?: string; loading: boolean }> = ({
  label,
  value,
  tone,
  note,
  loading,
}) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
    {loading ? (
      <div className="mt-2 h-7 w-24 animate-pulse rounded bg-slate-100" />
    ) : (
      <p className={`mt-1 text-xl font-bold ${tone}`}>{formatPeso(value ?? 0)}</p>
    )}
    {note && <p className="mt-0.5 text-xs text-slate-400">{note}</p>}
  </div>
);

export default TransactionsHistoryTab;
