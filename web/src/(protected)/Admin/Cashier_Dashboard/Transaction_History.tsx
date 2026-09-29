import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, StickyNote, X } from "lucide-react";
import { cashierAPI, type PaymentTransactionRow } from "../../../../library/cashier";
import { CashierTableSkeleton } from "./CashierSkeletons";

const PER_PAGE = 10;
const SEARCH_DEBOUNCE_MS = 400;
const LONG_NOTE_LENGTH = 60;
const COLUMN_COUNT = 7;

const formatPeso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString() : "—");

type PageMeta = { total: number; lastPage: number; from: number; to: number };

const TransactionHistory: React.FC = () => {
  const [rows, setRows] = useState<PaymentTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PageMeta>({ total: 0, lastPage: 1, from: 0, to: 0 });
  const [noteRow, setNoteRow] = useState<PaymentTransactionRow | null>(null);
  const requestIdRef = useRef(0);
  const tableTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const next = search.trim();
    if (next === appliedSearch) return;
    const handle = setTimeout(() => {
      setAppliedSearch(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search, appliedSearch]);

  const fetchRows = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const params = {
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      search: appliedSearch || undefined,
      per_page: PER_PAGE,
      page,
    };
    try {
      setLoading(true);
      console.log("[TransactionHistory] Fetching:", params);
      const res = await cashierAPI.transactions(params);
      if (requestId !== requestIdRef.current) return;
      if (res.data?.success) {
        const data = res.data.data;
        const list = Array.isArray(data) ? data : data?.data || [];
        const nextMeta: PageMeta = Array.isArray(data)
          ? { total: list.length, lastPage: 1, from: list.length ? 1 : 0, to: list.length }
          : {
              total: data?.total ?? list.length,
              lastPage: Math.max(1, data?.last_page ?? 1),
              from: data?.from ?? 0,
              to: data?.to ?? 0,
            };
        console.log("[TransactionHistory] Loaded:", {
          rows: list.length,
          total: nextMeta.total,
          page,
          lastPage: nextMeta.lastPage,
        });
        setRows(list);
        setMeta(nextMeta);
        if (page > nextMeta.lastPage) setPage(nextMeta.lastPage);
      }
    } catch (err) {
      console.error("[TransactionHistory] Error:", err);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [dateFrom, dateTo, appliedSearch, page]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const applySearchNow = () => {
    const next = search.trim();
    if (next !== appliedSearch) {
      setAppliedSearch(next);
      setPage(1);
    } else {
      fetchRows();
    }
  };

  const goToPage = (next: number) => {
    const target = Math.min(Math.max(1, next), meta.lastPage);
    if (target === page) return;
    console.log("[TransactionHistory] Go to page:", target);
    setPage(target);
    tableTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const hasFilters = !!(dateFrom || dateTo || search.trim());

  const clearFilters = () => {
    console.log("[TransactionHistory] Clear filters");
    setDateFrom("");
    setDateTo("");
    setSearch("");
    setAppliedSearch("");
    setPage(1);
  };

  const openNote = (row: PaymentTransactionRow) => {
    console.log("[TransactionHistory] View note:", row.payment_id);
    setNoteRow(row);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Transaction History</h1>
        <p className="text-sm text-slate-500 mt-1">All cash payments for church services</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-2">
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
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applySearchNow();
          }}
          placeholder="Search parishioner, service, OR, notes..."
          aria-label="Search transactions"
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
        />
        <button
          onClick={applySearchNow}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
        >
          Filter
        </button>
      </div>
      <div className="h-6 mb-2 flex items-center">
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="text-xs text-blue-600 hover:underline">
            Clear filters
          </button>
        )}
      </div>

      <div ref={tableTopRef} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Parishioner</th>
                <th className="text-left px-4 py-3">Service</th>
                <th className="text-left px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">OR No.</th>
                <th className="text-left px-4 py-3">Notes</th>
                <th className="text-left px-4 py-3">Received by</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-slate-100 ${loading && rows.length > 0 ? "opacity-60" : ""}`}>
              {loading && rows.length === 0 ? (
                <CashierTableSkeleton columns={COLUMN_COUNT} rows={PER_PAGE} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="py-16 text-center text-slate-500">
                    {hasFilters ? "No transactions match your filters" : "No transactions found"}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const note = row.notes?.trim() || "";
                  const isLong = note.length > LONG_NOTE_LENGTH;
                  return (
                    <tr key={row.payment_id}>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(row.created_at)}</td>
                      <td className="px-4 py-3 font-medium">{row.parishioner || "—"}</td>
                      <td className="px-4 py-3">{row.service_type || "—"}</td>
                      <td className="px-4 py-3 font-semibold text-blue-700 whitespace-nowrap">{formatPeso(row.amount)}</td>
                      <td className="px-4 py-3">{row.or_number || "—"}</td>
                      <td className="px-4 py-3 max-w-[16rem]">
                        {note ? (
                          <div>
                            <p className="text-slate-700 line-clamp-2 break-words" title={note}>
                              {note}
                            </p>
                            {isLong && (
                              <button
                                type="button"
                                onClick={() => openNote(row)}
                                className="mt-0.5 text-xs font-medium text-blue-600 hover:underline"
                              >
                                View
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{row.received_by || "—"}</td>
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
              <span className="font-medium text-slate-700">{meta.total}</span> transaction{meta.total === 1 ? "" : "s"}
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

      {noteRow && (
        <div
          className="fixed inset-0 bg-clear bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setNoteRow(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-note-title"
            className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 id="transaction-note-title" className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <StickyNote size={18} className="text-blue-600" />
                Transaction Note
              </h3>
              <button
                type="button"
                onClick={() => setNoteRow(null)}
                aria-label="Close"
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <dl className="bg-slate-50 rounded-lg p-3 text-sm grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5">
                <dt className="text-slate-500">Parishioner</dt>
                <dd className="font-medium text-slate-900 break-words">{noteRow.parishioner || "—"}</dd>
                <dt className="text-slate-500">Service</dt>
                <dd className="font-medium text-slate-900">{noteRow.service_type || "—"}</dd>
                <dt className="text-slate-500">Amount</dt>
                <dd className="font-medium text-blue-700">{formatPeso(noteRow.amount)}</dd>
                <dt className="text-slate-500">OR No.</dt>
                <dd className="font-medium text-slate-900">{noteRow.or_number || "—"}</dd>
                <dt className="text-slate-500">Date</dt>
                <dd className="font-medium text-slate-900">{formatDateTime(noteRow.created_at)}</dd>
              </dl>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Note</p>
                <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{noteRow.notes}</p>
              </div>
            </div>
            <div className="flex justify-end px-5 py-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setNoteRow(null)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;
