import React, { useState } from 'react';
import { Loader2, Lock, Pencil, Save, X } from 'lucide-react';
import PesoInput from '../../../../components/PesoInput';
import { reprintsAPI, type ReprintFeeSetting } from '../../../../../library/certificates';

interface ReprintFeeCardProps {
  fee: ReprintFeeSetting | null;
  onSaved: (fee: ReprintFeeSetting) => void;
  onAlert: (type: 'success' | 'error', message: string) => void;
}

const MIN_FEE = 1;
const MAX_FEE = 10000;

const peso = (n: number) =>
  `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ReprintFeeCard: React.FC<ReprintFeeCardProps> = ({ fee, onSaved, onAlert }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    console.log('[ReprintFee] Unlock for editing', fee);
    setValue(fee ? fee.amount.toFixed(2) : '100.00');
    setError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
  };

  const save = async () => {
    const amount = Number(value);
    if (!value || !Number.isFinite(amount)) {
      setError('Enter the reprint fee.');
      return;
    }
    if (amount < MIN_FEE) {
      setError(`The fee must be at least ${peso(MIN_FEE)}.`);
      return;
    }
    if (amount > MAX_FEE) {
      setError(`The fee cannot be more than ${peso(MAX_FEE)}.`);
      return;
    }
    if (fee && Math.abs(amount - fee.amount) < 0.005) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      console.log('[ReprintFee] Saving', amount);
      const res = await reprintsAPI.updateFee(amount);
      console.log('[ReprintFee] Saved', res.data);
      if (res.data?.success && res.data.data) {
        onSaved(res.data.data);
        setEditing(false);
        onAlert('success', res.data.message || 'Reprint fee saved.');
      } else {
        setError(res.data?.message || 'Could not save the fee.');
      }
    } catch (err: unknown) {
      console.error('[ReprintFee] Save failed', err);
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not save the fee.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reprint fee</p>
          {!editing ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-2xl font-bold text-slate-900">{fee ? peso(fee.amount) : '—'}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                <Lock size={12} aria-hidden /> Locked
              </span>
            </div>
          ) : (
            <div className="mt-1 w-full sm:w-56">
              <label htmlFor="reprint-fee-input" className="sr-only">
                Reprint fee
              </label>
              <PesoInput
                id="reprint-fee-input"
                value={value}
                onChange={(raw) => {
                  setValue(raw);
                  if (error) setError(null);
                }}
                hasError={!!error}
                disabled={saving}
                aria-describedby="reprint-fee-help"
              />
            </div>
          )}
          <p id="reprint-fee-help" className={`mt-1 text-xs ${error ? 'text-red-600' : 'text-slate-500'}`}>
            {error
              ? error
              : editing
                ? 'New reprints will use this amount. Reprints already waiting keep their old fee.'
                : fee?.updated_by
                  ? `Charged on every reprint. Last changed by ${fee.updated_by}${
                      fee.updated_at ? ` on ${new Date(fee.updated_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''
                    }.`
                  : 'Charged on every reprint. The treasurer collects it before you release the certificate.'}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          {!editing ? (
            <button
              type="button"
              onClick={startEdit}
              disabled={!fee}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Pencil size={14} aria-hidden /> Change
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                <X size={14} aria-hidden /> Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Save size={14} aria-hidden />}
                Save &amp; lock
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReprintFeeCard;
