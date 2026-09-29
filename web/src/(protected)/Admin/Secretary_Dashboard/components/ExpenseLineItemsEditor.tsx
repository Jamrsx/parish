import React from "react";
import { Plus, Trash2 } from "lucide-react";
import PesoInput from "../../../../components/PesoInput";
import type { ExpenseItemConfig } from "../../../../../library/expenses";
import {
  MAX_EXPENSE_LINE_ITEMS,
  editableRowTotal,
  newEditableLineItem,
  type EditableLineItem,
} from "../../../../../library/expenseLineItems";

const formatPeso = (n: number) =>
  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  config: ExpenseItemConfig;
  rows: EditableLineItem[];
  onChange: (rows: EditableLineItem[]) => void;
  /** Row-level error messages keyed by row key */
  rowErrors?: Record<string, string>;
  error?: string;
}

const ExpenseLineItemsEditor: React.FC<Props> = ({ config, rows, onChange, rowErrors = {}, error }) => {
  const isProduct = config.mode === "product";
  const grandTotal = rows.reduce((sum, r) => sum + editableRowTotal(r, config.mode), 0);

  const duplicateNames = (() => {
    const seen = new Map<string, number>();
    rows.forEach((r) => {
      const n = r.name.trim().toLowerCase();
      if (n) seen.set(n, (seen.get(n) || 0) + 1);
    });
    return new Set([...seen.entries()].filter(([, c]) => c > 1).map(([n]) => n));
  })();

  const update = (key: string, patch: Partial<EditableLineItem>) => {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    if (rows.length >= MAX_EXPENSE_LINE_ITEMS) {
      alert(`You can add up to ${MAX_EXPENSE_LINE_ITEMS} rows per expense.`);
      return;
    }
    console.log("[ExpenseLineItems] Add row", config.mode);
    onChange([...rows, newEditableLineItem()]);
  };

  const removeRow = (key: string) => {
    if (rows.length === 1) return;
    onChange(rows.filter((r) => r.key !== key));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-slate-700">
          {isProduct ? "Items" : config.noun[1].charAt(0).toUpperCase() + config.noun[1].slice(1)}{" "}
          <span className="text-red-500">*</span>
        </p>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
        >
          <Plus size={14} /> {config.addLabel}
        </button>
      </div>

      <div className={`rounded-lg border ${error ? "border-red-300" : "border-slate-200"} divide-y divide-slate-100`}>
        <div
          className={`hidden sm:grid gap-2 px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-500 rounded-t-lg ${
            isProduct ? "grid-cols-[1fr_70px_130px_100px_32px]" : "grid-cols-[1fr_150px_32px]"
          }`}
        >
          <span>{config.nameLabel}</span>
          {isProduct && <span>Qty</span>}
          <span>{config.amountLabel}</span>
          {isProduct && <span className="text-right">Total</span>}
          <span />
        </div>

        {rows.map((row, index) => {
          const rowError = rowErrors[row.key];
          const isDuplicate = duplicateNames.has(row.name.trim().toLowerCase());
          return (
            <div key={row.key} className="px-3 py-2">
              <div
                className={`grid gap-2 items-center ${
                  isProduct
                    ? "grid-cols-2 sm:grid-cols-[1fr_70px_130px_100px_32px]"
                    : "grid-cols-[1fr_auto] sm:grid-cols-[1fr_150px_32px]"
                }`}
              >
                <input
                  value={row.name}
                  maxLength={150}
                  onChange={(e) => update(row.key, { name: e.target.value })}
                  placeholder={index === 0 ? config.namePlaceholder : config.nameLabel}
                  aria-label={`${config.nameLabel} ${index + 1}`}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isProduct ? "col-span-2 sm:col-span-1" : ""
                  } ${rowError && !row.name.trim() ? "border-red-400" : "border-slate-200"}`}
                />
                {isProduct && (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={row.quantity}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 6);
                      update(row.key, { quantity: digits });
                    }}
                    aria-label={`Quantity ${index + 1}`}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                )}
                <div className={isProduct ? "" : "min-w-[130px]"}>
                  <PesoInput
                    value={isProduct ? row.unit_price : row.amount}
                    onChange={(raw) => update(row.key, isProduct ? { unit_price: raw } : { amount: raw })}
                    aria-label={`${config.amountLabel} ${index + 1}`}
                  />
                </div>
                {isProduct && (
                  <p className="text-sm font-semibold text-slate-800 text-right col-span-2 sm:col-span-1">
                    <span className="sm:hidden text-xs font-normal text-slate-500 mr-1">Total</span>
                    {formatPeso(editableRowTotal(row, config.mode))}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  disabled={rows.length === 1}
                  aria-label={`Remove row ${index + 1}`}
                  title={rows.length === 1 ? "At least one row is required" : "Remove row"}
                  className={`p-2 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent justify-self-end ${
                    isProduct ? "col-span-2 sm:col-span-1" : ""
                  }`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              {rowError && <p className="mt-1 text-xs text-red-600">{rowError}</p>}
              {!rowError && isDuplicate && (
                <p className="mt-1 text-xs text-amber-700">This name appears more than once. Check it isn't a duplicate.</p>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
        <span className="text-slate-600">
          Total · {rows.length} {rows.length === 1 ? config.noun[0] : config.noun[1]}
        </span>
        <span className="font-bold text-slate-900 text-base">{formatPeso(grandTotal)}</span>
      </div>
    </div>
  );
};

export default ExpenseLineItemsEditor;
