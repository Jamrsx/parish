import React, { useEffect, useState } from "react";
import type { BorrowRecord } from "../../../../../library/borrowRecords";
import { AlertTriangle } from "lucide-react";

interface ReturnItemModalProps {
  isOpen: boolean;
  record: BorrowRecord | null;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    has_damage: boolean;
    quantity_damaged: number;
    damage_notes?: string;
  }) => void;
}

const ReturnItemModal: React.FC<ReturnItemModalProps> = ({
  isOpen,
  record,
  submitting = false,
  onClose,
  onConfirm,
}) => {
  const [hasDamage, setHasDamage] = useState(false);
  const [quantityDamaged, setQuantityDamaged] = useState(1);
  const [damageNotes, setDamageNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const borrowedQty = record?.quantity_borrowed || 1;

  useEffect(() => {
    if (isOpen) {
      setHasDamage(false);
      setQuantityDamaged(1);
      setDamageNotes("");
      setError(null);
      console.log("Return item modal opened:", record);
    }
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  const handleSubmit = () => {
    if (hasDamage) {
      if (!quantityDamaged || quantityDamaged < 1) {
        setError("Enter how many items are damaged.");
        return;
      }
      if (quantityDamaged > borrowedQty) {
        setError(`Damaged quantity cannot exceed ${borrowedQty}.`);
        return;
      }
    }

    setError(null);
    onConfirm({
      has_damage: hasDamage,
      quantity_damaged: hasDamage ? quantityDamaged : 0,
      damage_notes: hasDamage ? damageNotes.trim() || undefined : undefined,
    });
  };

  const restoredPreview = hasDamage
    ? Math.max(0, borrowedQty - quantityDamaged)
    : borrowedQty;

  return (
    <div className="fixed inset-0 bg-clear bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 pt-6 pb-2">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-amber-600" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-center mt-3 text-slate-800">Return Item</h2>
          <p className="text-sm text-slate-600 text-center mt-2">
            <span className="font-medium text-slate-800">{record.inventory?.name || "Item"}</span>
            {" · "}
            Borrowed by {record.borrower_name} ({borrowedQty})
          </p>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Are there damaged items?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setHasDamage(false);
                  setError(null);
                }}
                className={`px-3 py-2.5 rounded-lg text-sm font-semibold border transition ${
                  !hasDamage
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                No
              </button>
              <button
                type="button"
                onClick={() => {
                  setHasDamage(true);
                  setError(null);
                }}
                className={`px-3 py-2.5 rounded-lg text-sm font-semibold border transition ${
                  hasDamage
                    ? "bg-rose-50 border-rose-300 text-rose-800"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Yes
              </button>
            </div>
          </div>

          {hasDamage && (
            <div className="space-y-3 rounded-lg border border-rose-100 bg-rose-50/50 p-3">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  How many are damaged? *
                </label>
                <input
                  type="number"
                  min={1}
                  max={borrowedQty}
                  value={quantityDamaged}
                  onChange={(e) => setQuantityDamaged(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                />
                <p className="text-xs text-slate-500 mt-1">Max: {borrowedQty}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Damage notes (optional)</label>
                <textarea
                  value={damageNotes}
                  onChange={(e) => setDamageNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Broken leg, missing part"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                />
              </div>
            </div>
          )}

          <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-sm text-slate-700">
            Stock to restore: <strong>{restoredPreview}</strong>
            {hasDamage && quantityDamaged > 0 && (
              <span className="text-rose-700">
                {" "}
                · Damaged (not restored): <strong>{quantityDamaged}</strong>
              </span>
            )}
          </div>

          {error && (
            <p className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Returning..." : "Confirm Return"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReturnItemModal;
