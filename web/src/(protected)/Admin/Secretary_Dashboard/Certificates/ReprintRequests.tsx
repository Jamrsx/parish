import React, { useEffect, useState } from 'react';
import { Ban, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Printer, RefreshCw, Search, X } from 'lucide-react';
import {
  reprintsAPI,
  type BaptismalCertificateDetails,
  type CertificateReprintRow,
  type ReprintStatus,
  type ReprintStatusCounts,
} from '../../../../../library/certificates';

interface ReprintRequestsProps {
  onPrint: (details: BaptismalCertificateDetails) => void;
  onAlert: (type: 'success' | 'error', message: string) => void;
  onCountsChange: (counts: ReprintStatusCounts) => void;
  refreshToken: number;
}

type Filter = ReprintStatus | 'all';

const PER_PAGE = 8;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'paid', label: 'Ready to release' },
  { id: 'awaiting_payment', label: 'Awaiting payment' },
  { id: 'released', label: 'Released' },
  { id: 'cancelled', label: 'Cancelled' },
];

const STATUS_STYLE: Record<ReprintStatus, { label: string; className: string }> = {
  awaiting_payment: { label: 'Awaiting payment', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  paid: { label: 'Paid · ready to release', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  released: { label: 'Released', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const peso = (n: number) =>
  `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '';

const errorMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

type Loaded = {
  key: string;
  rows: CertificateReprintRow[];
  lastPage: number;
  total: number;
  counts: ReprintStatusCounts | null;
  error: string | null;
};

const ReprintRequests: React.FC<ReprintRequestsProps> = ({ onPrint, onAlert, onCountsChange, refreshToken }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [loaded, setLoaded] = useState<Loaded>({ key: '', rows: [], lastPage: 1, total: 0, counts: null, error: null });
  const [releaseTarget, setReleaseTarget] = useState<CertificateReprintRow | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<CertificateReprintRow | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchKey = `${filter}|${debouncedSearch}|${page}|${refreshToken}|${reloadNonce}`;
  const loading = loaded.key !== fetchKey;

  useEffect(() => {
    let cancelled = false;
    const key = `${filter}|${debouncedSearch}|${page}|${refreshToken}|${reloadNonce}`;
    console.log('[Reprints] Loading', { filter, search: debouncedSearch, page });
    reprintsAPI
      .list({ status: filter, search: debouncedSearch || undefined, page, per_page: PER_PAGE })
      .then((res) => {
        if (cancelled) return;
        const p = res.data.data;
        const counts = res.data.counts ?? null;
        setLoaded({ key, rows: p.data || [], lastPage: p.last_page || 1, total: p.total || 0, counts, error: null });
        if (counts) onCountsChange(counts);
      })
      .catch((err) => {
        console.error('[Reprints] Load failed', err);
        if (!cancelled) {
          setLoaded({ key, rows: [], lastPage: 1, total: 0, counts: null, error: errorMessage(err, 'Could not load reprint requests.') });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [filter, debouncedSearch, page, refreshToken, reloadNonce, onCountsChange]);

  const reload = () => setReloadNonce((n) => n + 1);

  const printRow = (row: CertificateReprintRow) => {
    if (!row.details) {
      onAlert('error', 'The saved certificate details are missing, so this reprint cannot be printed.');
      return;
    }
    console.log('[Reprints] Printing paid reprint', row.reprint_id);
    onPrint(row.details);
    setReleaseTarget(row);
  };

  const confirmRelease = async () => {
    if (!releaseTarget) return;
    setReleasing(true);
    try {
      console.log('[Reprints] Releasing', releaseTarget.reprint_id);
      const res = await reprintsAPI.release(releaseTarget.reprint_id);
      console.log('[Reprints] Release response', res.data);
      onAlert('success', `Certificate for ${releaseTarget.person_name} released.`);
      setReleaseTarget(null);
      reload();
    } catch (err) {
      console.error('[Reprints] Release failed', err);
      onAlert('error', errorMessage(err, 'Could not mark the certificate as released.'));
    } finally {
      setReleasing(false);
    }
  };

  const openCancel = (row: CertificateReprintRow) => {
    setCancelTarget(row);
    setCancelReason('');
    setCancelError(null);
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    if (cancelReason.trim().length < 3) {
      setCancelError('Please give a reason for cancelling.');
      return;
    }
    setCancelling(true);
    try {
      console.log('[Reprints] Cancelling', cancelTarget.reprint_id, cancelReason);
      await reprintsAPI.cancel(cancelTarget.reprint_id, cancelReason.trim());
      onAlert('success', `Reprint request for ${cancelTarget.person_name} cancelled.`);
      setCancelTarget(null);
      reload();
    } catch (err) {
      console.error('[Reprints] Cancel failed', err);
      setCancelError(errorMessage(err, 'Could not cancel the request.'));
    } finally {
      setCancelling(false);
    }
  };

  const counts = loaded.counts;
  const countFor = (id: Filter) =>
    !counts ? null : id === 'all' ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[id];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Reprint requests</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Print and release a reprint once the treasurer has marked it paid.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, OR no. or #"
              aria-label="Search reprint requests"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={reload}
            aria-label="Refresh reprint requests"
            title="Refresh"
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const count = countFor(f.id);
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setFilter(f.id);
                setPage(1);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label}
              {count !== null && count > 0 && (
                <span
                  className={`rounded-full px-1.5 text-[10px] font-bold ${
                    active ? 'bg-white text-blue-700' : f.id === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading && loaded.rows.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
          <Loader2 size={18} className="animate-spin" aria-hidden /> Loading…
        </div>
      ) : loaded.error && !loading ? (
        <div className="m-4 flex items-center justify-between gap-3 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <span>{loaded.error}</span>
          <button type="button" onClick={reload} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white">
            Try again
          </button>
        </div>
      ) : loaded.rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-500">
          {debouncedSearch
            ? 'No reprint requests match your search.'
            : filter === 'all'
              ? 'No reprint requests yet. Use Reprint on an issued certificate below to start one.'
              : 'Nothing here right now.'}
        </div>
      ) : (
        <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Fee</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loaded.rows.map((row) => {
                const style = STATUS_STYLE[row.status];
                return (
                  <tr key={row.reprint_id} className={row.status === 'paid' ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{row.person_name}</p>
                      <p className="text-xs text-slate-500">
                        Reprint #{row.reprint_id}
                        {row.reason ? ` · ${row.reason}` : ''}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">{peso(row.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.className}`}>
                        {style.label}
                      </span>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.status === 'awaiting_payment' && 'Waiting for the treasurer'}
                        {row.status === 'paid' &&
                          `Paid ${when(row.paid_at)}${row.or_number ? ` · OR ${row.or_number}` : ''}${row.paid_by ? ` · ${row.paid_by}` : ''}`}
                        {row.status === 'released' && `Released ${when(row.released_at)}${row.released_by ? ` by ${row.released_by}` : ''}`}
                        {row.status === 'cancelled' && `${row.cancel_reason || 'Cancelled'}${row.cancelled_by ? ` · ${row.cancelled_by}` : ''}`}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {when(row.requested_at)}
                      {row.requested_by && <span className="block">by {row.requested_by}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {row.status === 'paid' && (
                          <button
                            type="button"
                            onClick={() => printRow(row)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            <Printer size={14} aria-hidden /> Print &amp; release
                          </button>
                        )}
                        {row.status === 'awaiting_payment' && (
                          <button
                            type="button"
                            onClick={() => openCancel(row)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                          >
                            <Ban size={14} aria-hidden /> Cancel
                          </button>
                        )}
                        {(row.status === 'released' || row.status === 'cancelled') && (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {loaded.total > PER_PAGE && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
          <span>
            Page {page} of {loaded.lastPage} · {loaded.total} request{loaded.total === 1 ? '' : 's'}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Previous page"
              className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft size={16} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(loaded.lastPage, p + 1))}
              disabled={page >= loaded.lastPage}
              aria-label="Next page"
              className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
        </div>
      )}

      {releaseTarget && (
        <div className="fixed inset-0 bg-clear bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="release-title" className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 id="release-title" className="text-lg font-semibold text-slate-900">Release the certificate?</h3>
              <button
                type="button"
                onClick={() => setReleaseTarget(null)}
                disabled={releasing}
                aria-label="Close"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <div className="space-y-3 p-5 text-sm text-slate-600">
              <p>
                Did the certificate for <strong className="text-slate-900">{releaseTarget.person_name}</strong> print correctly?
              </p>
              <p>
                Mark it as released once you hand it over. After that it can't be printed again without a new paid reprint.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setReleaseTarget(null)}
                disabled={releasing}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                Not yet
              </button>
              <button
                type="button"
                onClick={() => releaseTarget.details && onPrint(releaseTarget.details)}
                disabled={releasing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Printer size={14} aria-hidden /> Print again
              </button>
              <button
                type="button"
                onClick={confirmRelease}
                disabled={releasing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {releasing ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <CheckCircle2 size={14} aria-hidden />}
                Yes, mark released
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 bg-clear bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="cancel-reprint-title" className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 id="cancel-reprint-title" className="text-lg font-semibold text-slate-900">Cancel reprint request</h3>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
                aria-label="Close"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <p className="text-sm text-slate-600">
                The request for <strong className="text-slate-900">{cancelTarget.person_name}</strong> ({peso(cancelTarget.amount)}) will
                be removed from the treasurer's list.
              </p>
              <div>
                <label htmlFor="cancel-reprint-reason" className="mb-1 block text-sm font-medium text-slate-700">
                  Reason *
                </label>
                <input
                  id="cancel-reprint-reason"
                  value={cancelReason}
                  onChange={(e) => {
                    setCancelReason(e.target.value);
                    if (cancelError) setCancelError(null);
                  }}
                  maxLength={255}
                  autoFocus
                  placeholder="e.g. Person did not return to pay"
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-rose-500 ${
                    cancelError ? 'border-red-400' : 'border-slate-200'
                  }`}
                />
                {cancelError && <p className="mt-1 text-xs text-red-600">{cancelError}</p>}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                Keep request
              </button>
              <button
                type="button"
                onClick={confirmCancel}
                disabled={cancelling}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {cancelling ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Ban size={14} aria-hidden />}
                Cancel request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReprintRequests;
