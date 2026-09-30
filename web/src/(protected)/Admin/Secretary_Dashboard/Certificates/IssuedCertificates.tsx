import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Loader2, Printer, Search, X } from 'lucide-react';
import {
  certificatesAPI,
  type BaptismalCertificateDetails,
  type IssuedCertificateRow,
} from '../../../../../library/certificates';
import BaptismalCertificateSheet, { SHEET_HEIGHT_IN, SHEET_WIDTH_IN } from './BaptismalCertificateSheet';
import { formatLongDate } from './certificateFormat';

const PER_PAGE = 10;
const VIEW_SCALE = 0.62;

interface IssuedCertificatesProps {
  onReprint: (details: BaptismalCertificateDetails) => void;
  refreshToken: number;
}

type Loaded = {
  key: string;
  rows: IssuedCertificateRow[];
  lastPage: number;
  total: number;
  error: string | null;
};

const IssuedCertificates: React.FC<IssuedCertificatesProps> = ({ onReprint, refreshToken }) => {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState<Loaded>({ key: '', rows: [], lastPage: 1, total: 0, error: null });
  const [viewing, setViewing] = useState<IssuedCertificateRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchKey = `${debouncedSearch}|${page}|${refreshToken}`;

  useEffect(() => {
    let cancelled = false;
    const key = `${debouncedSearch}|${page}|${refreshToken}`;
    console.log('[Certificates] Loading issued history', { search: debouncedSearch, page });
    certificatesAPI
      .getIssued({ search: debouncedSearch || undefined, page, per_page: PER_PAGE })
      .then((res) => {
        if (cancelled) return;
        const p = res.data.data;
        setLoaded({ key, rows: p.data || [], lastPage: p.last_page || 1, total: p.total || 0, error: null });
      })
      .catch((err) => {
        console.error('[Certificates] Failed to load issued history', err);
        if (!cancelled) {
          setLoaded({ key, rows: [], lastPage: 1, total: 0, error: err?.response?.data?.message || 'Could not load the history.' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, page, refreshToken]);

  const loading = loaded.key !== fetchKey;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Issued Certificates</h2>
          <p className="text-xs text-slate-500 mt-0.5">Every printed certificate, newest first. Reprint uses the exact saved details.</p>
        </div>
        <div className="relative sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, purpose or signatory"
            aria-label="Search issued certificates"
            className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 size={18} className="animate-spin" aria-hidden /> Loading…
        </div>
      ) : loaded.error ? (
        <div className="m-4 rounded-lg bg-red-50 border border-red-100 p-4 text-sm text-red-700">{loaded.error}</div>
      ) : loaded.rows.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-500">
          {debouncedSearch ? 'No certificates match your search.' : 'No certificates have been issued yet.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date issued</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Signed by</th>
                <th className="px-4 py-3">Issued by</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loaded.rows.map((row) => (
                <tr key={row.issued_certificate_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatLongDate(row.date_issued)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {row.person_name}
                    {row.request_id && <span className="ml-2 text-xs font-normal text-slate-400">Request #{row.request_id}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.purpose || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{row.signatory_name}</td>
                  <td className="px-4 py-3 text-slate-500">{row.issued_by || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setViewing(row)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        <Eye size={14} aria-hidden /> View
                      </button>
                      <button
                        type="button"
                        onClick={() => onReprint(row.details)}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        <Printer size={14} aria-hidden /> Reprint
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && loaded.total > 0 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
          <span>
            Page {page} of {loaded.lastPage} · {loaded.total} certificate{loaded.total === 1 ? '' : 's'}
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

      {viewing && (
        <div
          className="fixed inset-0 bg-clear bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Certificate of ${viewing.person_name}`}
          onClick={() => setViewing(null)}
        >
          <div className="bg-white rounded-xl shadow-2xl max-h-[95vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3">
              <div>
                <h3 className="font-semibold text-slate-900">{viewing.person_name}</h3>
                <p className="text-xs text-slate-500">Issued {formatLongDate(viewing.date_issued)}{viewing.issued_by ? ` by ${viewing.issued_by}` : ''}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onReprint(viewing.details)}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <Printer size={14} aria-hidden /> Reprint
                </button>
                <button
                  type="button"
                  onClick={() => setViewing(null)}
                  aria-label="Close"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                >
                  <X size={18} aria-hidden />
                </button>
              </div>
            </div>
            <div className="p-4 bg-slate-50">
              <div
                className="overflow-hidden shadow-md ring-1 ring-slate-200 mx-auto"
                style={{ width: SHEET_WIDTH_IN * 96 * VIEW_SCALE, height: SHEET_HEIGHT_IN * 96 * VIEW_SCALE }}
              >
                <div style={{ transform: `scale(${VIEW_SCALE})`, transformOrigin: 'top left' }}>
                  <BaptismalCertificateSheet data={viewing.details} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IssuedCertificates;
