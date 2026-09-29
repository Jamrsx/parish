import type { ExpenseItemMode, ExpenseLineItem } from "./expenses";

export interface EditableLineItem {
  key: string;
  name: string;
  /** Raw peso string (no commas) — person mode */
  amount: string;
  /** Whole number string — product mode */
  quantity: string;
  /** Raw peso string (no commas) — product mode */
  unit_price: string;
}

export const MAX_EXPENSE_LINE_ITEMS = 50;

let keySeq = 0;
export const newEditableLineItem = (): EditableLineItem => ({
  key: `li-${Date.now()}-${keySeq++}`,
  name: "",
  amount: "",
  quantity: "1",
  unit_price: "",
});

export const editableRowTotal = (row: EditableLineItem, mode: ExpenseItemMode): number => {
  if (mode === "product") {
    const qty = parseInt(row.quantity, 10) || 0;
    return Math.round(qty * (Number(row.unit_price) || 0) * 100) / 100;
  }
  return Number(row.amount) || 0;
};

export const toEditableLineItems = (items: ExpenseLineItem[] | undefined | null): EditableLineItem[] => {
  if (!items || items.length === 0) return [newEditableLineItem()];
  return items.map((item) => ({
    ...newEditableLineItem(),
    name: item.name || "",
    amount: item.amount !== undefined ? Number(item.amount).toFixed(2) : "",
    quantity: item.quantity !== undefined ? String(item.quantity) : "1",
    unit_price: item.unit_price !== undefined ? Number(item.unit_price).toFixed(2) : "",
  }));
};

export const toPayloadLineItems = (rows: EditableLineItem[], mode: ExpenseItemMode): ExpenseLineItem[] =>
  rows.map((r) =>
    mode === "product"
      ? { name: r.name.trim(), quantity: parseInt(r.quantity, 10) || 0, unit_price: Number(r.unit_price) || 0 }
      : { name: r.name.trim(), amount: Number(r.amount) || 0 }
  );

/** Returns row errors keyed by row key; empty object when valid. */
export const validateEditableLineItems = (
  rows: EditableLineItem[],
  mode: ExpenseItemMode,
  labels: { name: string; amount: string }
): Record<string, string> => {
  const errors: Record<string, string> = {};
  rows.forEach((r) => {
    if (!r.name.trim()) {
      errors[r.key] = `${labels.name} is required.`;
    } else if (mode === "product") {
      const qty = parseInt(r.quantity, 10);
      if (!qty || qty < 1) errors[r.key] = "Quantity must be at least 1.";
      else if (!(Number(r.unit_price) > 0)) errors[r.key] = `${labels.amount} must be greater than zero.`;
    } else if (!(Number(r.amount) > 0)) {
      errors[r.key] = `${labels.amount} must be greater than zero.`;
    }
  });
  return errors;
};
