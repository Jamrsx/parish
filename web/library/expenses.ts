import { api } from './api';
import type { ApiResponse, PaginatedResponse } from './api';
import type { IncomeSplit } from './secretary-dashboard';

export type ExpenseCategory =
  | 'water_bill'
  | 'electricity_bill'
  | 'office_supply'
  | 'maintenance'
  | 'manpower'
  | 'fuel'
  | 'kitchen_supplies'
  | 'allowance';

export type ExpenseStatus = 'draft' | 'forwarded' | 'verified' | 'returned';

/** none = single amount; person = name + amount; product = name + quantity × unit price */
export type ExpenseItemMode = 'none' | 'person' | 'product';

export interface ExpenseItemConfig {
  mode: ExpenseItemMode;
  nameLabel: string;
  amountLabel: string;
  addLabel: string;
  /** Singular / plural noun for summaries, e.g. "person" / "persons" */
  noun: [string, string];
  namePlaceholder: string;
}

export interface ExpenseCategoryInfo {
  value: ExpenseCategory;
  label: string;
  hint: string;
  /** Label shown for the payee_name field; null hides the field */
  payeeLabel: string | null;
  payeeRequired: boolean;
  requiresBillingPeriod: boolean;
  items: ExpenseItemConfig;
}

const NO_ITEMS: ExpenseItemConfig = {
  mode: 'none',
  nameLabel: '',
  amountLabel: '',
  addLabel: '',
  noun: ['', ''],
  namePlaceholder: '',
};

export const EXPENSE_CATEGORIES: ExpenseCategoryInfo[] = [
  { value: 'water_bill', label: 'Water Bill', hint: 'Monthly water bill', payeeLabel: null, payeeRequired: false, requiresBillingPeriod: true, items: NO_ITEMS },
  { value: 'electricity_bill', label: 'Electricity Bill', hint: 'Monthly electricity bill', payeeLabel: null, payeeRequired: false, requiresBillingPeriod: true, items: NO_ITEMS },
  {
    value: 'office_supply', label: 'Office Supply', hint: 'Paper, ink, printers, etc.', payeeLabel: 'Supplier', payeeRequired: false, requiresBillingPeriod: false,
    items: { mode: 'product', nameLabel: 'Item', amountLabel: 'Unit price', addLabel: 'Add item', noun: ['item', 'items'], namePlaceholder: 'e.g. Bond paper (ream)' },
  },
  { value: 'maintenance', label: 'Maintenance', hint: 'Cleaning of the church area and renovations', payeeLabel: 'Contractor / Supplier', payeeRequired: false, requiresBillingPeriod: false, items: NO_ITEMS },
  {
    value: 'manpower', label: 'Manpower', hint: 'Salary of workers such as carpenters or gardeners', payeeLabel: null, payeeRequired: false, requiresBillingPeriod: false,
    items: { mode: 'person', nameLabel: 'Worker name', amountLabel: 'Salary', addLabel: 'Add worker', noun: ['worker', 'workers'], namePlaceholder: 'e.g. Juan Dela Cruz' },
  },
  { value: 'fuel', label: 'Fuel', hint: 'Fuel for vehicles, generator, etc.', payeeLabel: 'Vehicle / Equipment', payeeRequired: false, requiresBillingPeriod: false, items: NO_ITEMS },
  {
    value: 'kitchen_supplies', label: 'Kitchen Supplies', hint: 'Cooking pots, knives and other kitchen items', payeeLabel: 'Supplier', payeeRequired: false, requiresBillingPeriod: false,
    items: { mode: 'product', nameLabel: 'Item', amountLabel: 'Unit price', addLabel: 'Add item', noun: ['item', 'items'], namePlaceholder: 'e.g. Cooking pot' },
  },
  {
    value: 'allowance', label: 'Allowance', hint: 'Monthly allowance for working students / scholars of the church', payeeLabel: null, payeeRequired: false, requiresBillingPeriod: false,
    items: { mode: 'person', nameLabel: 'Scholar name', amountLabel: 'Monthly allowance', addLabel: 'Add scholar', noun: ['scholar', 'scholars'], namePlaceholder: 'e.g. Maria Santos' },
  },
];

export interface ExpenseLineItem {
  name: string;
  /** person mode */
  amount?: number;
  /** product mode */
  quantity?: number;
  unit_price?: number;
  total?: number;
}

export const lineItemTotal = (item: ExpenseLineItem): number =>
  item.total ?? (item.quantity !== undefined ? Number(item.quantity) * Number(item.unit_price || 0) : Number(item.amount || 0));

/** "Juan, Maria +2" for person-itemized categories; null otherwise */
export const lineItemPeople = (category: string, items?: ExpenseLineItem[] | null, max = 2): string | null => {
  if (getExpenseCategory(category)?.items.mode !== 'person' || !items || items.length === 0) return null;
  const names = items.map((i) => i.name).filter(Boolean);
  const shown = names.slice(0, max).join(', ');
  return names.length > max ? `${shown} +${names.length - max}` : shown;
};

export const lineItemsSummary = (category: string, items?: ExpenseLineItem[] | null): string | null => {
  const info = getExpenseCategory(category);
  if (!info || info.items.mode === 'none' || !items || items.length === 0) return null;
  const [one, many] = info.items.noun;
  return `${items.length} ${items.length === 1 ? one : many}`;
};

export const getExpenseCategory = (value?: string | null): ExpenseCategoryInfo | undefined =>
  EXPENSE_CATEGORIES.find((c) => c.value === value);

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  draft: 'Draft',
  forwarded: 'Awaiting Cashier',
  verified: 'Verified',
  returned: 'Returned',
};

export interface ExpenseRow {
  expense_id: number;
  category: ExpenseCategory;
  category_label: string;
  description: string;
  payee_name?: string | null;
  amount: number;
  line_items?: ExpenseLineItem[];
  expense_date: string;
  billing_period?: string | null;
  reference_no?: string | null;
  notes?: string | null;
  status: ExpenseStatus;
  recorded_by?: string | null;
  forwarded_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  return_reason?: string | null;
  created_at?: string;
}

export interface ExpenseSummary {
  draft: number;
  forwarded: number;
  forwarded_amount: number;
  returned: number;
  verified_this_month: number;
}

export interface ExpenseListResponse extends ApiResponse<PaginatedResponse<ExpenseRow>> {
  summary?: ExpenseSummary;
}

export interface ExpensePayload {
  category: ExpenseCategory;
  description: string;
  payee_name?: string | null;
  amount?: number | null;
  line_items?: ExpenseLineItem[] | null;
  expense_date: string;
  billing_period?: string | null;
  reference_no?: string | null;
  notes?: string | null;
}

export interface ExpenseListParams {
  status?: string;
  category?: string;
  month?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  per_page?: number;
  page?: number;
}

export interface GeneralReportCategoryRow {
  category: ExpenseCategory;
  label: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface GeneralReportWeekRow {
  label: string;
  start_date: string;
  end_date: string;
  income: number;
  church_share?: number;
  archdiocese_share?: number;
  expenses: number;
  net: number;
  church_net?: number;
}

export interface GeneralReportExpenseItem {
  expense_id: number;
  category: ExpenseCategory;
  category_label: string;
  description: string;
  payee_name?: string | null;
  amount: number;
  line_items?: ExpenseLineItem[];
  expense_date: string;
  billing_period?: string | null;
  reference_no?: string | null;
  recorded_by?: string | null;
  reviewed_by?: string | null;
}

export interface GeneralReportData {
  period: 'monthly' | 'weekly';
  label: string;
  start_date: string;
  end_date: string;
  income: {
    service_fees: number;
    mass_collections: number;
    donations: number;
    special_intentions: number;
    total: number;
  };
  expenses: {
    total: number;
    count: number;
    by_category: GeneralReportCategoryRow[];
    items: GeneralReportExpenseItem[];
  };
  pending_verification: { count: number; amount: number };
  net: number;
  sharing?: IncomeSplit;
  /** Church share minus verified expenses */
  church_net?: number;
  weekly_breakdown: GeneralReportWeekRow[];
  generated_at: string;
}

export type GeneralReportParams =
  | { period: 'monthly'; year: number; month: number }
  | { period: 'weekly'; week_start: string };

export const expenseAPI = {
  list: (params?: ExpenseListParams) => {
    console.log('[ExpenseAPI] list', params);
    return api.get<ExpenseListResponse>('/admin/expenses', { params });
  },

  create: (data: ExpensePayload) => {
    console.log('[ExpenseAPI] create', data);
    return api.post<ApiResponse<ExpenseRow>>('/admin/expenses', data);
  },

  update: (id: number, data: ExpensePayload) => {
    console.log('[ExpenseAPI] update', id, data);
    return api.put<ApiResponse<ExpenseRow>>(`/admin/expenses/${id}`, data);
  },

  remove: (id: number) => {
    console.log('[ExpenseAPI] remove', id);
    return api.delete<ApiResponse<null>>(`/admin/expenses/${id}`);
  },

  forward: (ids: number[]) => {
    console.log('[ExpenseAPI] forward', ids);
    return api.post<ApiResponse<{ forwarded_count: number; skipped_count: number; total_amount: number }>>(
      '/admin/expenses/forward',
      { ids }
    );
  },

  verify: (ids: number[]) => {
    console.log('[ExpenseAPI] verify', ids);
    return api.post<ApiResponse<{ verified_count: number; total_amount: number }>>('/admin/expenses/verify', { ids });
  },

  returnToSecretary: (id: number, return_reason: string) => {
    console.log('[ExpenseAPI] return', id, return_reason);
    return api.post<ApiResponse<ExpenseRow>>(`/admin/expenses/${id}/return`, { return_reason });
  },

  generalReport: (params: GeneralReportParams) => {
    console.log('[ExpenseAPI] general report', params);
    return api.get<ApiResponse<GeneralReportData>>('/admin/cashier/general-report', { params });
  },
};

export const getApiErrorMessage = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
  const data = e?.response?.data;
  if (data?.errors) {
    const first = Object.values(data.errors)[0];
    if (first?.[0]) return first[0];
  }
  return data?.message || fallback;
};
