import React from "react";
import { X } from "lucide-react";
import {
  getExpenseCategory,
  lineItemTotal,
  type ExpenseLineItem,
} from "../../../../library/expenses";

const formatPeso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface ExpenseItemsModalProps {
  category: string;
  categoryLabel: string;
  description: string;
  items: ExpenseLineItem[];
  total: number;
  onClose: () => void;
}

const ExpenseItemsModal: React.FC<ExpenseItemsModalProps> = ({
  category,
  categoryLabel,
  description,
  items,
  total,
  onClose,
}) => {
  const config = getExpenseCategory(category)?.items;
  const isProduct = config?.mode === "product";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-clear bg-opacity-20 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-items-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3 border-b border-slate-100">
          <div className="min-w-0">
            <h3 id="expense-items-title" className="text-lg font-bold text-slate-800">
              {categoryLabel} breakdown
            </h3>
            <p className="text-sm text-slate-500 truncate">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4">
          <table className="w-full text-sm">
            <thead className="text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left py-2 pr-2 w-8">#</th>
                <th className="text-left py-2 pr-2">{config?.nameLabel || "Name"}</th>
                {isProduct && <th className="text-right py-2 px-2">Qty</th>}
                {isProduct && <th className="text-right py-2 px-2">Unit price</th>}
                <th className="text-right py-2 pl-2">{isProduct ? "Total" : config?.amountLabel || "Amount"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, index) => (
                <tr key={`${item.name}-${index}`}>
                  <td className="py-2 pr-2 text-slate-400">{index + 1}</td>
                  <td className="py-2 pr-2 text-slate-800">{item.name}</td>
                  {isProduct && <td className="py-2 px-2 text-right">{item.quantity}</td>}
                  {isProduct && <td className="py-2 px-2 text-right">{formatPeso(Number(item.unit_price || 0))}</td>}
                  <td className="py-2 pl-2 text-right font-medium">{formatPeso(lineItemTotal(item))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200">
                <td colSpan={isProduct ? 4 : 2} className="pt-3 font-semibold text-slate-800">
                  Total ({items.length} {items.length === 1 ? config?.noun[0] : config?.noun[1]})
                </td>
                <td className="pt-3 text-right font-bold text-blue-700">{formatPeso(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex justify-end px-6 pb-5 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 rounded-lg text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpenseItemsModal;
