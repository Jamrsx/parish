import React, { useEffect, useState } from 'react';
import { BookOpen, FileText, Loader2, PenLine, Search, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import {
  certificatesAPI,
  type BaptismRecordOption,
  type CertificateRequestOption,
} from '../../../../../library/certificates';
import { formatLongDate, todayYmd } from './certificateFormat';

export type SourceTab = 'records' | 'requests' | 'manual';

interface SourcePickerProps {
  tab: SourceTab;
  onTabChange: (tab: SourceTab) => void;
  selectedKey: string | null;
  onPickRecord: (record: BaptismRecordOption) => void;
  onPickRequest: (request: CertificateRequestOption) => void;
  onStartManual: () => void;
  onClose: () => void;
  refreshToken: number;
}

type Loaded<T> = { key: string; items: T[]; error: string | null };

const TABS: { id: SourceTab; label: string; icon: typeof BookOpen }[] = [
  { id: 'records', label: 'Baptism Records', icon: BookOpen },
  { id: 'requests', label: 'Certificate Requests', icon: FileText },
  { id: 'manual', label: 'Manual Entry', icon: PenLine },
];

const statusBadge: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  done: 'bg-emerald-100 text-emerald-800',
};

const statusLabel: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  done: 'Completed',
};

const useDebounced = (value: string, delay = 350) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

const SourcePicker: React.FC<SourcePickerProps> = ({
  tab,
  onTabChange,
  selectedKey,
  onPickRecord,
  onPickRequest,
  onStartManual,
  onClose,
  refreshToken,
}) => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search.trim());
  const [records, setRecords] = useState<Loaded<BaptismRecordOption>>({ key: '', items: [], error: null });
  const [requests, setRequests] = useState<Loaded<CertificateRequestOption>>({ key: '', items: [], error: null });

  const fetchKey = `${tab}|${debouncedSearch}|${refreshToken}`;
  const today = todayYmd();

  useEffect(() => {
    if (tab === 'manual') return;
    let cancelled = false;
    const key = `${tab}|${debouncedSearch}|${refreshToken}`;
    console.log('[Certificates] Loading source list', { tab, search: debouncedSearch });

    const request =
      tab === 'records'
        ? certificatesAPI.getBaptismRecords(debouncedSearch).then((res) => {
            if (!cancelled) setRecords({ key, items: res.data.data || [], error: null });
          })
        : certificatesAPI.getCertificateRequests(debouncedSearch).then((res) => {
            if (!cancelled) setRequests({ key, items: res.data.data || [], error: null });
          });

    request.catch((err) => {
      console.error('[Certificates] Failed to load source list', err);
      const message = err?.response?.data?.message || 'Could not load the list. Please try again.';
      if (cancelled) return;
      if (tab === 'records') setRecords({ key, items: [], error: message });
      else setRequests({ key, items: [], error: message });
    });

    return () => {
      cancelled = true;
    };
  }, [tab, debouncedSearch, refreshToken]);

  const current = tab === 'records' ? records : requests;
  const loading = tab !== 'manual' && current.key !== fetchKey;

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="certificate-picker-title" className="text-base font-semibold text-slate-900">Choose the person</h2>
            <p className="text-xs text-slate-500 mt-0.5">Pick from the records, a certificate request, or type the details yourself.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Certificate source">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => onTabChange(id)}
              className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors ${
                tab === id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon size={14} aria-hidden />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        {tab !== 'manual' && (
          <div className="relative mt-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === 'records' ? "Search child, father or mother's name" : 'Search name, requester or #request'}
              aria-label="Search"
              autoFocus
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-[280px] p-2">
        {tab === 'manual' ? (
          <div className="p-4 text-sm text-slate-600 space-y-3">
            <p>
              Use this for old baptisms that are only in the paper register. Fill in every detail on the right, exactly as
              written in the Baptismal Register.
            </p>
            <button
              type="button"
              onClick={onStartManual}
              className={`w-full rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                selectedKey === 'manual'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              {selectedKey === 'manual' ? 'Manual entry in progress' : 'Start a blank certificate'}
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 size={18} className="animate-spin" aria-hidden /> Loading…
          </div>
        ) : current.error ? (
          <div className="m-2 rounded-lg bg-red-50 border border-red-100 p-4 text-sm text-red-700">{current.error}</div>
        ) : current.items.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500 px-4">
            {debouncedSearch
              ? 'No matches. Try a different spelling, or use Manual Entry.'
              : tab === 'records'
                ? 'No approved or completed baptisms yet.'
                : 'No Baptismal Certificate requests yet.'}
          </div>
        ) : tab === 'records' ? (
          <ul className="space-y-1">
            {records.items.map((r) => {
              const key = `record-${r.baptism_id}`;
              const future = !!r.baptism_date && r.baptism_date > today;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => onPickRecord(r)}
                    className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                      selectedKey === key ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-sm text-slate-900">{r.person_name || '—'}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge[r.status]}`}>
                        {statusLabel[r.status]}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      Born {formatLongDate(r.birth_date)} · Baptism {formatLongDate(r.baptism_date)}
                    </div>
                    {future && (
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-700">
                        <AlertTriangle size={12} aria-hidden /> Baptism date has not happened yet
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="space-y-1">
            {requests.items.map((r) => {
              const key = `request-${r.request_id}`;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => onPickRequest(r)}
                    className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                      selectedKey === key ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-sm text-slate-900">{r.person_name || '—'}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge[r.status]}`}>
                        {statusLabel[r.status]}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      Request #{r.request_id}
                      {r.requested_by ? ` · by ${r.requested_by}` : ''} · {r.payment_status === 'paid' ? 'Paid' : r.payment_status === 'partial' ? 'Partially paid' : 'Unpaid'}
                    </div>
                    <div className={`mt-1 flex items-center gap-1 text-[11px] ${r.matched_record ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {r.matched_record ? (
                        <>
                          <CheckCircle2 size={12} aria-hidden /> Baptism record found — details will be filled in
                        </>
                      ) : (
                        'No baptism record matched — check the paper register'
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default SourcePicker;
