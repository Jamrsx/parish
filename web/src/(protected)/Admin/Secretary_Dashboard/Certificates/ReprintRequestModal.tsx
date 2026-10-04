import React, { useEffect, useState } from 'react';
import { Loader2, Receipt, Send, X } from 'lucide-react';
import {
  reprintsAPI,
  type CertificateReprintRow,
  type IssuedCertificateRow,
  type ReprintFeeSetting,
} from '../../../../../library/certificates';
import { formatLongDate } from './certificateFormat';

interface ReprintRequestModalProps {
  certificate: IssuedCertificateRow;
  fee: ReprintFeeSetting | null;
  onClose: () => void;
  onRequested: (reprint: CertificateReprintRow, message: string) => void;
}

const peso = (n: number) =>
  `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ReprintRequestModal: React.FC<ReprintRequestModalProps> = ({ certificate, fee, onClose, onRequested }) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  const submit = async () => {
    if (reason.length > 255) {
      setError('Keep the reason under 255 characters.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      console.log('[Reprint] Requesting reprint', { id: certificate.issued_certificate_id, reason });
      const res = await reprintsAPI.request(certificate.issued_certificate_id, reason.trim());
      console.log('[Reprint] Request response', res.data);
      if (res.data?.success && res.data.data) {
        onRequested(res.data.data, res.data.message || 'Reprint sent to the treasurer.');
      } else {
        setError(res.data?.message || 'Could not send the reprint request.');
      }
    } catch (err: unknown) {
      console.error('[Reprint] Request failed', err);
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Could not send the reprint request.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-clear bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reprint-request-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 id="reprint-request-title" className="text-lg font-semibold text-slate-900">
            Request reprint
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-slate-900">{certificate.person_name}</p>
            <p className="text-slate-600">
              Baptismal Certificate · first issued {formatLongDate(certificate.date_issued)}
            </p>
            {certificate.purpose && <p className="text-slate-500">Purpose: {certificate.purpose}</p>}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium text-blue-900">
              <Receipt size={16} aria-hidden /> Reprint fee
            </span>
            <span className="text-xl font-bold text-blue-900">{fee ? peso(fee.amount) : '—'}</span>
          </div>

          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>The request goes to the treasurer.</li>
            <li>The person pays the fee to the treasurer.</li>
            <li>Once it is marked paid, print and release it from <strong>Reprint requests</strong>.</li>
          </ol>

          <div>
            <label htmlFor="reprint-reason" className="mb-1 block text-sm font-medium text-slate-700">
              Reason <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="reprint-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              maxLength={255}
              placeholder="e.g. Lost original, needs another copy"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !fee}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Send size={14} aria-hidden />}
            Send to treasurer
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReprintRequestModal;
