import React, { useMemo, useState } from "react";
import type { InventoryItem } from "../../../../../../library/inventory";

export type StockAdjustMode = "add" | "deduct";

interface AdjustStockModalProps {
  isOpen: boolean;
  mode: StockAdjustMode;
  item: InventoryItem | null;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (amount: number, note?: string) => void;
}

const NOTE_MAX = 500;

const AdjustStockModal: React.FC<AdjustStockModalProps> = ({ isOpen, item, mode, ...rest }) => {
  if (!isOpen || !item) return null;
  return <AdjustStockForm key={`${mode}-${item.inventory_id}`} item={item} mode={mode} {...rest} />;
};

type AdjustStockFormProps = Omit<AdjustStockModalProps, "isOpen" | "item"> & { item: InventoryItem };

const AdjustStockForm: React.FC<AdjustStockFormProps> = ({
  mode,
  item,
  submitting = false,
  onClose,
  onConfirm,
}) => {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const currentQty = item.quantity ?? 0;
  const parsedAmount = Number(amount);
  const isValidAmount = Number.isInteger(parsedAmount) && parsedAmount > 0;

  const nextQty = useMemo(() => {
    if (!isValidAmount) return null;
    return mode === "add" ? currentQty + parsedAmount : currentQty - parsedAmount;
  }, [isValidAmount, mode, currentQty, parsedAmount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAmount) {
      setError("Enter a whole number greater than 0.");
      return;
    }
    if (mode === "deduct" && parsedAmount > currentQty) {
      setError(`Cannot deduct more than current stock (${currentQty}).`);
      return;
    }
    console.log("[Inventory] Adjust stock confirm", {
      item: item.name,
      mode,
      currentQty,
      amount: parsedAmount,
      nextQty,
      note: note.trim() || null,
    });
    onConfirm(parsedAmount, note.trim() || undefined);
  };

  const isAdd = mode === "add";

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className={`px-6 py-4 border-b ${isAdd ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"}`}>
          <h2 className="text-xl font-bold text-slate-900">
            {isAdd ? "Add Stock" : "Deduct Stock"}
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">{item.name}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-500">Current stock</p>
              <p className="text-lg font-semibold text-slate-900">{currentQty}</p>
            </div>
            <div>
              <p className="text-slate-500">New stock</p>
              <p className={`text-lg font-semibold ${nextQty === null ? "text-slate-400" : nextQty < 0 ? "text-red-600" : "text-slate-900"}`}>
                {nextQty === null ? "—" : nextQty}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Amount to {isAdd ? "add" : "deduct"} *
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
              placeholder="e.g. 20"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Note <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
              rows={2}
              placeholder={isAdd ? "e.g. Purchased from supplier, donated by parish council" : "e.g. Used for Sunday mass, expired"}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-[11px] text-slate-400 mt-0.5">
              Saved in Inventory History · {note.length}/{NOTE_MAX}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 ${
                isAdd ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              {submitting ? "Saving..." : isAdd ? "Add Stock" : "Deduct Stock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdjustStockModal;
