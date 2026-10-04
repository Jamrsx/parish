<?php

namespace App\Http\Controllers;

use App\Models\ChurchExpense;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ChurchExpenseController extends Controller
{
    public function index(Request $request)
    {
        $query = ChurchExpense::with(['recordedBy', 'reviewedBy']);

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('category') && $request->category !== 'all') {
            $query->where('category', $request->category);
        }

        if ($request->filled('month') && preg_match('/^\d{4}-\d{2}$/', $request->month)) {
            [$year, $month] = array_map('intval', explode('-', $request->month));
            $query->whereYear('expense_date', $year)->whereMonth('expense_date', $month);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('expense_date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('expense_date', '<=', $request->date_to);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('description', 'LIKE', "%{$search}%")
                    ->orWhere('payee_name', 'LIKE', "%{$search}%")
                    ->orWhere('reference_no', 'LIKE', "%{$search}%");
            });
        }

        $perPage = min((int) $request->input('per_page', 20), 500);
        $rows = $query->orderByDesc('expense_date')->orderByDesc('expense_id')->paginate($perPage);
        $rows->getCollection()->transform(fn ($e) => $this->transform($e));

        $monthStart = Carbon::now()->startOfMonth();
        $monthEnd = Carbon::now()->endOfMonth();

        return response()->json([
            'success' => true,
            'data' => $rows,
            'summary' => [
                'draft' => ChurchExpense::where('status', 'draft')->count(),
                'forwarded' => ChurchExpense::where('status', 'forwarded')->count(),
                'forwarded_amount' => (float) ChurchExpense::where('status', 'forwarded')->sum('amount'),
                'returned' => ChurchExpense::where('status', 'returned')->count(),
                'verified_this_month' => (float) ChurchExpense::verified()
                    ->whereBetween('expense_date', [$monthStart->toDateString(), $monthEnd->toDateString()])
                    ->sum('amount'),
            ],
            'categories' => $this->categoryOptions(),
        ]);
    }

    /**
     * Read-only list for the priest: only forwarded or verified expenses (drafts/returned stay with the secretary).
     */
    public function priestIndex(Request $request)
    {
        $status = in_array($request->status, ['verified', 'forwarded'], true) ? $request->status : 'verified';

        $query = ChurchExpense::with(['recordedBy', 'reviewedBy'])->where('status', $status);

        if ($request->filled('category') && $request->category !== 'all') {
            $query->where('category', $request->category);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('expense_date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('expense_date', '<=', $request->date_to);
        }

        $perPage = min((int) $request->input('per_page', 20), 500);
        $rows = $query->orderByDesc('expense_date')->orderByDesc('expense_id')->paginate($perPage);
        $rows->getCollection()->transform(fn ($e) => $this->transform($e));

        return response()->json([
            'success' => true,
            'data' => $rows,
        ]);
    }

    public function store(Request $request)
    {
        /** @var User $user */
        $user = $request->user();

        if (!$user->isSecretary()) {
            return response()->json([
                'success' => false,
                'message' => 'Only the secretary can record church expenses.',
            ], 403);
        }

        $validator = $this->validator($request);
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
                'message' => $validator->errors()->first(),
            ], 422);
        }

        $expense = ChurchExpense::create(array_merge(
            $this->payload($request),
            [
                'status' => 'draft',
                'recorded_by' => $user->user_id,
            ]
        ));

        Log::info('Church expense recorded', ['expense_id' => $expense->expense_id, 'by' => $user->user_id]);

        return response()->json([
            'success' => true,
            'message' => 'Expense saved as draft. Forward it to the cashier when ready.',
            'data' => $this->transform($expense->load(['recordedBy', 'reviewedBy'])),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        /** @var User $user */
        $user = $request->user();

        if (!$user->isSecretary()) {
            return response()->json([
                'success' => false,
                'message' => 'Only the secretary can edit church expenses.',
            ], 403);
        }

        $expense = ChurchExpense::findOrFail($id);

        if (!$expense->isEditable()) {
            return response()->json([
                'success' => false,
                'message' => 'Only draft or returned expenses can be edited.',
            ], 422);
        }

        $validator = $this->validator($request);
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
                'message' => $validator->errors()->first(),
            ], 422);
        }

        $expense->update($this->payload($request));

        return response()->json([
            'success' => true,
            'message' => 'Expense updated.',
            'data' => $this->transform($expense->fresh(['recordedBy', 'reviewedBy'])),
        ]);
    }

    public function destroy(Request $request, $id)
    {
        /** @var User $user */
        $user = $request->user();

        if (!$user->isSecretary()) {
            return response()->json([
                'success' => false,
                'message' => 'Only the secretary can delete church expenses.',
            ], 403);
        }

        $expense = ChurchExpense::findOrFail($id);

        if (!$expense->isEditable()) {
            return response()->json([
                'success' => false,
                'message' => 'Only draft or returned expenses can be deleted.',
            ], 422);
        }

        $expense->delete();

        return response()->json([
            'success' => true,
            'message' => 'Expense deleted.',
            'data' => null,
        ]);
    }

    /**
     * Secretary forwards one or many draft/returned expenses to the cashier.
     */
    public function forward(Request $request)
    {
        /** @var User $user */
        $user = $request->user();

        if (!$user->isSecretary()) {
            return response()->json([
                'success' => false,
                'message' => 'Only the secretary can forward expenses.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
                'message' => 'Select at least one expense to forward.',
            ], 422);
        }

        $expenses = ChurchExpense::whereIn('expense_id', $request->ids)
            ->whereIn('status', ChurchExpense::EDITABLE_STATUSES)
            ->get();

        if ($expenses->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'None of the selected expenses can be forwarded (only draft or returned).',
            ], 422);
        }

        DB::transaction(function () use ($expenses) {
            $expenses->each(fn (ChurchExpense $expense) => $expense->update([
                'status' => 'forwarded',
                'forwarded_at' => now(),
                'reviewed_by' => null,
                'reviewed_at' => null,
                'return_reason' => null,
            ]));
        });

        $count = $expenses->count();
        $total = round((float) $expenses->sum('amount'), 2);

        return response()->json([
            'success' => true,
            'message' => "{$count} expense(s) forwarded to the cashier.",
            'data' => [
                'forwarded_count' => $count,
                'skipped_count' => count($request->ids) - $count,
                'total_amount' => $total,
            ],
        ]);
    }

    /**
     * Cashier verifies one or many forwarded expenses.
     */
    public function verify(Request $request)
    {
        /** @var User $user */
        $user = $request->user();

        if (!$user->isCashier()) {
            return response()->json([
                'success' => false,
                'message' => 'Only the cashier can verify expenses.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
                'message' => 'Select at least one expense to verify.',
            ], 422);
        }

        $expenses = ChurchExpense::whereIn('expense_id', $request->ids)->forwarded()->get();

        if ($expenses->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'None of the selected expenses are awaiting verification.',
            ], 422);
        }

        DB::transaction(function () use ($expenses, $user) {
            $expenses->each(fn (ChurchExpense $expense) => $expense->update([
                'status' => 'verified',
                'reviewed_by' => $user->user_id,
                'reviewed_at' => now(),
                'return_reason' => null,
            ]));
        });

        $count = $expenses->count();

        return response()->json([
            'success' => true,
            'message' => "{$count} expense(s) verified.",
            'data' => [
                'verified_count' => $count,
                'total_amount' => round((float) $expenses->sum('amount'), 2),
            ],
        ]);
    }

    /**
     * Cashier returns a forwarded expense to the secretary with a reason.
     */
    public function returnToSecretary(Request $request, $id)
    {
        /** @var User $user */
        $user = $request->user();

        if (!$user->isCashier()) {
            return response()->json([
                'success' => false,
                'message' => 'Only the cashier can return expenses.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'return_reason' => 'required|string|min:5|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
                'message' => 'Please give a reason (at least 5 characters).',
            ], 422);
        }

        $expense = ChurchExpense::findOrFail($id);

        if ($expense->status !== 'forwarded') {
            return response()->json([
                'success' => false,
                'message' => 'Only forwarded expenses can be returned.',
            ], 422);
        }

        $expense->update([
            'status' => 'returned',
            'reviewed_by' => $user->user_id,
            'reviewed_at' => now(),
            'return_reason' => $request->return_reason,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Expense returned to the secretary.',
            'data' => $this->transform($expense->fresh(['recordedBy', 'reviewedBy'])),
        ]);
    }

    private function validator(Request $request)
    {
        $category = $request->input('category');
        $itemized = ChurchExpense::isItemized($category);
        $isPerson = in_array($category, ChurchExpense::PERSON_ITEM_CATEGORIES, true);
        $isProduct = in_array($category, ChurchExpense::PRODUCT_ITEM_CATEGORIES, true);
        $personLabel = $category === 'allowance' ? 'scholar' : 'worker';

        $rules = [
            'category' => ['required', Rule::in(array_keys(ChurchExpense::CATEGORIES))],
            'description' => 'required|string|min:3|max:255',
            'payee_name' => [
                Rule::requiredIf(in_array($category, ChurchExpense::PAYEE_REQUIRED_CATEGORIES, true)),
                'nullable',
                'string',
                'max:150',
            ],
            'amount' => $itemized ? 'nullable' : 'required|numeric|min:0.01|max:9999999999',
            'expense_date' => 'required|date|before_or_equal:today',
            'billing_period' => [
                Rule::requiredIf(in_array($category, ChurchExpense::BILL_CATEGORIES, true)),
                'nullable',
                'date_format:Y-m',
            ],
            'reference_no' => 'nullable|string|max:100',
            'notes' => 'nullable|string|max:500',
        ];

        if ($itemized) {
            $rules['line_items'] = 'required|array|min:1|max:' . ChurchExpense::MAX_LINE_ITEMS;
            $rules['line_items.*.name'] = 'required|string|min:1|max:150';
        }
        if ($isPerson) {
            $rules['line_items.*.amount'] = 'required|numeric|min:0.01|max:9999999999';
        }
        if ($isProduct) {
            $rules['line_items.*.quantity'] = 'required|integer|min:1|max:100000';
            $rules['line_items.*.unit_price'] = 'required|numeric|min:0.01|max:9999999999';
        }

        return Validator::make($request->all(), $rules, [
            'billing_period.required' => 'Billing month is required for utility bills.',
            'expense_date.before_or_equal' => 'Expense date cannot be in the future.',
            'amount.required' => 'Amount is required.',
            'amount.min' => 'Amount must be greater than zero.',
            'line_items.required' => $isPerson
                ? "Add at least one {$personLabel}."
                : 'Add at least one item.',
            'line_items.min' => $isPerson
                ? "Add at least one {$personLabel}."
                : 'Add at least one item.',
            'line_items.max' => 'You can add up to ' . ChurchExpense::MAX_LINE_ITEMS . ' rows per expense.',
            'line_items.*.name.required' => $isPerson
                ? "Every row needs the {$personLabel}'s name."
                : 'Every row needs an item name.',
            'line_items.*.amount.required' => $category === 'allowance'
                ? 'Every scholar needs a monthly allowance amount.'
                : 'Every worker needs a salary amount.',
            'line_items.*.amount.min' => 'Each amount must be greater than zero.',
            'line_items.*.quantity.required' => 'Every item needs a quantity.',
            'line_items.*.quantity.min' => 'Quantity must be at least 1.',
            'line_items.*.quantity.integer' => 'Quantity must be a whole number.',
            'line_items.*.unit_price.required' => 'Every item needs a unit price.',
            'line_items.*.unit_price.min' => 'Unit price must be greater than zero.',
        ]);
    }

    /**
     * Server-side totals for itemized categories (client amounts are not trusted).
     *
     * @return array{0: array<int, array<string, mixed>>|null, 1: float}
     */
    private function normalizeLineItems(string $category, array $rows, float $fallbackAmount): array
    {
        if (in_array($category, ChurchExpense::PERSON_ITEM_CATEGORIES, true)) {
            $items = collect($rows)->map(fn ($row) => [
                'name' => trim((string) ($row['name'] ?? '')),
                'amount' => round((float) ($row['amount'] ?? 0), 2),
            ])->values()->all();

            return [$items, round(collect($items)->sum('amount'), 2)];
        }

        if (in_array($category, ChurchExpense::PRODUCT_ITEM_CATEGORIES, true)) {
            $items = collect($rows)->map(function ($row) {
                $qty = (int) ($row['quantity'] ?? 0);
                $price = round((float) ($row['unit_price'] ?? 0), 2);

                return [
                    'name' => trim((string) ($row['name'] ?? '')),
                    'quantity' => $qty,
                    'unit_price' => $price,
                    'total' => round($qty * $price, 2),
                ];
            })->values()->all();

            return [$items, round(collect($items)->sum('total'), 2)];
        }

        return [null, round($fallbackAmount, 2)];
    }

    private function payload(Request $request): array
    {
        $category = $request->category;
        [$lineItems, $amount] = $this->normalizeLineItems(
            $category,
            (array) $request->input('line_items', []),
            (float) $request->input('amount', 0)
        );
        $isPerson = in_array($category, ChurchExpense::PERSON_ITEM_CATEGORIES, true);

        return [
            'category' => $category,
            'description' => trim($request->description),
            'payee_name' => !$isPerson && $request->filled('payee_name') ? trim($request->payee_name) : null,
            'amount' => $amount,
            'line_items' => $lineItems,
            'expense_date' => $request->expense_date,
            'billing_period' => in_array($category, ChurchExpense::BILL_CATEGORIES, true)
                ? $request->billing_period
                : null,
            'reference_no' => $request->filled('reference_no') ? trim($request->reference_no) : null,
            'notes' => $request->notes,
        ];
    }

    private function categoryOptions(): array
    {
        return collect(ChurchExpense::CATEGORIES)
            ->map(fn ($label, $value) => ['value' => $value, 'label' => $label])
            ->values()
            ->all();
    }

    private function transform(ChurchExpense $e): array
    {
        return [
            'expense_id' => $e->expense_id,
            'category' => $e->category,
            'category_label' => $e->category_label,
            'description' => $e->description,
            'payee_name' => $e->payee_name,
            'amount' => (float) $e->amount,
            'line_items' => $e->line_items ?: [],
            'expense_date' => $e->expense_date?->format('Y-m-d'),
            'billing_period' => $e->billing_period,
            'reference_no' => $e->reference_no,
            'notes' => $e->notes,
            'status' => $e->status,
            'recorded_by' => $e->recordedBy?->full_name,
            'forwarded_at' => $e->forwarded_at?->toIso8601String(),
            'reviewed_by' => $e->reviewedBy?->full_name,
            'reviewed_at' => $e->reviewed_at?->toIso8601String(),
            'return_reason' => $e->return_reason,
            'created_at' => $e->created_at?->toIso8601String(),
        ];
    }
}
