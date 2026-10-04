import React, { useEffect, useState } from "react";
import { Building2, Church, Loader2, Lock, Pencil, Save, X } from "lucide-react";
import type { IncomeSplit } from "../../../../library/secretary-dashboard";
import { incomeSharingAPI, type IncomeSharingSetting } from "../../../../library/cashier";

interface IncomeSharingCardProps {
  sharing: IncomeSplit;
  periodLabel: string;
  /** Only the cashier can change the ratio */
  editable?: boolean;
  onRatioSaved?: (setting: IncomeSharingSetting) => void;
}

const formatPeso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const errorMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const IncomeSharingCard: React.FC<IncomeSharingCardProps> = ({ sharing, periodLabel, editable = false, onRatioSaved }) => {
  const [setting, setSetting] = useState<IncomeSharingSetting | null>(null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!editable) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await incomeSharingAPI.get();
        console.log("[IncomeSharing] Ratio setting", res.data);
        if (!cancelled && res.data?.success) setSetting(res.data.data);
      } catch (err) {
        console.error("[IncomeSharing] Could not load ratio setting", err);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [editable]);

  const churchPercent = sharing.church_percent;
  const archPercent = sharing.archdiocese_percent;
  const typed = Number(value);
  const typedValid = value !== "" && Number.isInteger(typed) && typed >= 1 && typed <= 99;

  const startEdit = () => {
    console.log("[IncomeSharing] Unlock ratio", churchPercent);
    setValue(String(churchPercent));
    setError(null);
    setNotice(null);
    setEditing(true);
  };

  const save = async () => {
    if (!typedValid) {
      setError("Enter a whole number from 1 to 99 for the church share.");
      return;
    }
    if (typed === churchPercent) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await incomeSharingAPI.update(typed);
      console.log("[IncomeSharing] Saved", res.data);
      if (res.data?.success) {
        setSetting(res.data.data);
        setEditing(false);
        setNotice(res.data.message || "Sharing ratio saved.");
        onRatioSaved?.(res.data.data);
      } else {
        setError(res.data?.message || "Could not save the ratio.");
      }
    } catch (err) {
      console.error("[IncomeSharing] Save failed", err);
      setError(errorMessage(err, "Could not save the ratio."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Income sharing</h3>
          <p className="text-xs text-slate-500">
            {periodLabel} · all income ({formatPeso(sharing.total)}) split {churchPercent}% church / {archPercent}% archdiocese
          </p>
        </div>

        {editable && (
          <div className="flex flex-col items-start sm:items-end gap-1">
            {!editing ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                  <Lock size={12} aria-hidden /> {churchPercent}% / {archPercent}% locked
                </span>
                <button
                  type="button"
                  onClick={startEdit}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Pencil size={12} aria-hidden /> Change
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="church-share-input" className="text-xs font-medium text-slate-600">
                  Church
                </label>
                <div className="relative">
                  <input
                    id="church-share-input"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={99}
                    step={1}
                    value={value}
                    onChange={(e) => {
                      setValue(e.target.value.replace(/[^0-9]/g, "").slice(0, 2));
                      if (error) setError(null);
                    }}
                    disabled={saving}
                    aria-invalid={!!error}
                    aria-describedby="church-share-help"
                    className={`w-20 rounded-lg border py-1.5 pl-2 pr-6 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      error ? "border-red-400" : "border-slate-200"
                    }`}
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                </div>
                <span className="text-xs text-slate-600">
                  Archdiocese <strong>{typedValid ? 100 - typed : "–"}%</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  aria-label="Cancel change"
                  className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                >
                  <X size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Save size={12} aria-hidden />}
                  Save &amp; lock
                </button>
              </div>
            )}
            <p id="church-share-help" className={`text-[11px] ${error ? "text-red-600" : "text-slate-400"}`}>
              {error
                ? error
                : editing
                  ? "Applies to all reports, including past months."
                  : setting?.updated_by
                    ? `Last changed by ${setting.updated_by}`
                    : "Default ratio"}
            </p>
          </div>
        )}
      </div>

      {notice && (
        <div
          role="status"
          className="mb-3 flex items-start justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
        >
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="text-emerald-700 hover:text-emerald-900">
            <X size={14} aria-hidden />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-emerald-800">Church share ({churchPercent}%)</p>
            <Church size={18} className="text-emerald-600" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-900">{formatPeso(sharing.church_amount)}</p>
          <p className="text-xs text-emerald-700">Kept by the parish</p>
        </div>
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-indigo-800">Archdiocese share ({archPercent}%)</p>
            <Building2 size={18} className="text-indigo-600" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-bold text-indigo-900">{formatPeso(sharing.archdiocese_amount)}</p>
          <p className="text-xs text-indigo-700">To be remitted to the archdiocese</p>
        </div>
      </div>

      <div
        className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100"
        role="img"
        aria-label={`${churchPercent}% church, ${archPercent}% archdiocese`}
      >
        <div className="bg-emerald-500" style={{ width: `${churchPercent}%` }} />
        <div className="bg-indigo-500" style={{ width: `${archPercent}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
        <span>Church {churchPercent}%</span>
        <span>Archdiocese {archPercent}%</span>
      </div>
    </div>
  );
};

export default IncomeSharingCard;
