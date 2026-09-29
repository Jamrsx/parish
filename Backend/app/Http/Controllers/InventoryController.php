<?php

namespace App\Http\Controllers;

use App\Models\Inventory;
use App\Models\BorrowRecord;
use App\Models\InventoryHistory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class InventoryController extends Controller
{
    /**
     * Display a listing of inventory items.
     */
    public function index(Request $request)
    {
        Inventory::ensureBuiltinCatalog();

        $query = Inventory::query()->orderBy('category')->orderBy('name');

        // Apply filters
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where('name', 'LIKE', "%{$search}%");
        }

        if ($request->has('type') && $request->type) {
            $query->where('type', $request->type);
        }

        // Add category filter
        if ($request->has('category') && $request->category) {
            $query->where('category', $request->category);
        }

        if ($request->has('is_borrowable') && $request->is_borrowable !== null) {
            $query->where('is_borrowable', $request->is_borrowable);
        }

        $perPage = $request->per_page ?? 15;
        $items = $query->paginate($perPage);

        // Add computed status to each item
        foreach ($items as $item) {
            $item->current_status = $item->current_status;
            $item->display_status = $item->display_status;
            $item->available_quantity = $item->available_quantity;
            $item->is_builtin = (bool) $item->is_builtin;
            $item->ran_out_at = $item->ran_out_at;
        }

        return response()->json([
            'success' => true,
            'data' => $items
        ]);
    }

    //get all categories
    public function getCategories()
    {
        $categories = Inventory::getCategories();

        return response()->json([
            'success' => true,
            'data' => $categories
        ]);
    }

    /**
     * Store a newly created inventory item.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'quantity' => 'required|integer|min:0',
            'type' => 'required|in:item,consumable',
            'category' => 'nullable|string|max:255',
            'is_borrowable' => 'boolean',
            'history_note' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $item = Inventory::create([
            'name' => $request->name,
            'quantity' => $request->quantity,
            'type' => $request->type,
            'category' => $request->category,
            'is_borrowable' => $request->is_borrowable ?? false,
            'is_builtin' => false,
        ]);

        InventoryHistory::record($item, InventoryHistory::ACTION_CREATED, (int) $item->quantity, 0, (int) $item->quantity, [
            'details' => [
                'category' => $item->category,
                'type' => $item->type,
                'is_borrowable' => (bool) $item->is_borrowable,
            ],
            'notes' => $request->input('history_note'),
        ]);

        return response()->json([
            'success' => true,
            'data' => $item,
            'message' => 'Item added successfully!'
        ], 201);
    }

    /**
     * Display the specified inventory item.
     */
    public function show($id)
    {
        $item = Inventory::find($id);

        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found'
            ], 404);
        }

        $item->current_status = $item->current_status;
        $item->display_status = $item->display_status;
        $item->available_quantity = $item->available_quantity;

        return response()->json([
            'success' => true,
            'data' => $item
        ]);
    }

    /**
     * Update the specified inventory item.
     */
    public function update(Request $request, $id)
    {
        $item = Inventory::find($id);

        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'quantity' => 'sometimes|required|integer|min:0',
            'type' => 'sometimes|required|in:item,consumable',
            'category' => 'nullable|string|max:255',
            'is_borrowable' => 'boolean',
            'history_note' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $trackedFields = ['name', 'type', 'category', 'is_borrowable'];
        $original = [
            'quantity' => (int) $item->quantity,
            'name' => $item->name,
            'type' => $item->type,
            'category' => $item->category,
            'is_borrowable' => (bool) $item->is_borrowable,
        ];

        $item->update($request->except(['history_note']));

        $this->recordUpdateHistory($item, $original, $trackedFields, $request->input('history_note'));

        return response()->json([
            'success' => true,
            'data' => $item,
            'message' => 'Item updated successfully!'
        ]);
    }

    /**
     * Remove the specified inventory item.
     */
    public function destroy($id)
    {
        $item = Inventory::find($id);

        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found'
            ], 404);
        }

        if ($item->is_builtin) {
            return response()->json([
                'success' => false,
                'message' => 'Catalog items stay in inventory even at quantity 0. Update the quantity instead of deleting.'
            ], 400);
        }

        // Check if item has active borrow records
        $activeBorrow = BorrowRecord::where('inventory_id', $id)
            ->whereIn('status', ['borrowed', 'overdue'])
            ->exists();

        if ($activeBorrow) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete item that is currently borrowed'
            ], 400);
        }

        InventoryHistory::record($item, InventoryHistory::ACTION_DELETED, 0, (int) $item->quantity, null, [
            'details' => [
                'deleted_inventory_id' => $item->inventory_id,
                'category' => $item->category,
                'type' => $item->type,
            ],
        ]);

        $item->delete();

        return response()->json([
            'success' => true,
            'message' => 'Item deleted successfully!'
        ]);
    }

    /**
     * Borrow an item.
     */
    public function borrow(Request $request, $id)
    {
        $item = Inventory::find($id);

        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'borrower_name' => 'required|string|max:255',
            'borrower_phone' => 'nullable|string|max:20',
            'quantity' => 'required|integer|min:1',
            'expected_return_date' => 'required|date|after_or_equal:today',
            'location' => 'required|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        // Check if item is borrowable
        if (!$item->is_borrowable) {
            return response()->json([
                'success' => false,
                'message' => 'This item is not borrowable.'
            ], 400);
        }

        // Check available quantity
        if ($item->available_quantity < $request->quantity) {
            return response()->json([
                'success' => false,
                'message' => 'Insufficient quantity available. Only ' . $item->available_quantity . ' available.'
            ], 400);
        }

        try {
            DB::beginTransaction();

            $lockedItem = Inventory::where('inventory_id', $item->inventory_id)
                ->lockForUpdate()
                ->first();

            if (!$lockedItem) {
                throw new \RuntimeException('Inventory item not found.');
            }

            if ((int) $lockedItem->quantity < (int) $request->quantity) {
                throw new \RuntimeException(
                    'Insufficient quantity available. Only ' . $lockedItem->quantity . ' available.'
                );
            }

            // Create borrow record
            $borrowRecord = BorrowRecord::create([
                'inventory_id' => $lockedItem->inventory_id,
                'borrower_name' => $request->borrower_name,
                'borrower_phone' => $request->borrower_phone,
                'quantity_borrowed' => $request->quantity,
                'quantity_damaged' => 0,
                'location' => $request->location,
                'borrowed_at' => now(),
                'expected_return_date' => $request->expected_return_date,
                'status' => 'borrowed',
            ]);

            // Deduct from available stock immediately
            $before = (int) $lockedItem->quantity;
            $lockedItem->quantity = $before - (int) $request->quantity;
            $lockedItem->save();

            InventoryHistory::record(
                $lockedItem,
                InventoryHistory::ACTION_BORROWED,
                -((int) $request->quantity),
                $before,
                (int) $lockedItem->quantity,
                [
                    'borrow_record_id' => $borrowRecord->borrow_record_id,
                    'details' => [
                        'borrower_name' => $request->borrower_name,
                        'borrower_phone' => $request->borrower_phone,
                        'location' => $request->location,
                        'expected_return_date' => $request->expected_return_date,
                    ],
                ]
            );
            \Log::info('Inventory ran_out_at after borrow', [
                'inventory_id' => $lockedItem->inventory_id,
                'quantity' => (int) $lockedItem->quantity,
                'ran_out_at' => $lockedItem->ran_out_at,
            ]);

            DB::commit();

            \Log::info('Inventory borrowed — stock deducted', [
                'inventory_id' => $lockedItem->inventory_id,
                'borrow_record_id' => $borrowRecord->borrow_record_id,
                'qty_borrowed' => (int) $request->quantity,
                'quantity_before' => $before,
                'quantity_after' => (int) $lockedItem->quantity,
            ]);

            $borrowRecord->load('inventory');
            $borrowRecord->setAttribute('available_quantity_after', (int) $lockedItem->quantity);

            return response()->json([
                'success' => true,
                'data' => $borrowRecord,
                'message' => 'Item borrowed successfully! Available now: ' . (int) $lockedItem->quantity,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Return a borrowed item (optionally log damaged quantity).
     */
    public function returnItem(Request $request, $id)
    {
        $item = Inventory::find($id);

        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'borrow_record_id' => 'nullable|integer|exists:borrow_records,borrow_record_id',
            'quantity_damaged' => 'nullable|integer|min:0',
            'damage_notes' => 'nullable|string|max:500',
            'has_damage' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
                'message' => 'Invalid return details.',
            ], 422);
        }

        // Prefer explicit borrow record when provided (Borrower Logs)
        if ($request->filled('borrow_record_id')) {
            $borrowRecord = BorrowRecord::where('borrow_record_id', $request->borrow_record_id)
                ->where('inventory_id', $id)
                ->whereIn('status', ['borrowed', 'overdue'])
                ->first();
        } else {
            $borrowRecord = BorrowRecord::where('inventory_id', $id)
                ->whereIn('status', ['borrowed', 'overdue'])
                ->latest('borrowed_at')
                ->first();
        }

        if (!$borrowRecord) {
            return response()->json([
                'success' => false,
                'message' => 'No active borrow record found for this item.'
            ], 400);
        }

        $hasDamage = filter_var($request->input('has_damage', false), FILTER_VALIDATE_BOOLEAN);
        $quantityDamaged = $hasDamage ? (int) $request->input('quantity_damaged', 0) : 0;

        if ($quantityDamaged > (int) $borrowRecord->quantity_borrowed) {
            return response()->json([
                'success' => false,
                'message' => 'Damaged quantity cannot exceed quantity borrowed (' . $borrowRecord->quantity_borrowed . ').',
            ], 422);
        }

        if ($hasDamage && $quantityDamaged < 1) {
            return response()->json([
                'success' => false,
                'message' => 'Enter how many items are damaged, or choose No damage.',
            ], 422);
        }

        try {
            DB::beginTransaction();

            $borrowRecord->markAsReturned(
                $quantityDamaged,
                $request->input('damage_notes')
            );

            DB::commit();

            $borrowRecord->refresh()->load('inventory');
            $availableAfter = (int) ($borrowRecord->inventory?->quantity ?? 0);
            $restored = (int) $borrowRecord->quantity_borrowed - (int) $borrowRecord->quantity_damaged;
            $message = $quantityDamaged > 0
                ? "Item returned. {$restored} restored to stock; {$quantityDamaged} damaged (not restored). Available now: {$availableAfter}."
                : "Item returned successfully! Available now: {$availableAfter}.";

            \Log::info('Inventory return completed', [
                'inventory_id' => $id,
                'borrow_record_id' => $borrowRecord->borrow_record_id,
                'quantity_damaged' => $quantityDamaged,
                'available_after' => $availableAfter,
            ]);

            return response()->json([
                'success' => true,
                'data' => $borrowRecord,
                'message' => $message,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Get all borrowed items (active borrow records).
     */
    public function getBorrowed()
    {
        $borrowRecords = BorrowRecord::with('inventory')
            ->whereIn('status', ['borrowed', 'overdue'])
            ->latest('borrowed_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $borrowRecords
        ]);
    }

    /**
 * Get all borrow records - For logs
 */
public function getAllBorrowRecords(Request $request)
{
    $query = BorrowRecord::with('inventory')
                         ->latest('borrowed_at');
    
    // Apply status filter if provided
    if ($request->has('status') && $request->status) {
        $query->where('status', $request->status);
    }
    
    // Apply search filter
    if ($request->has('search') && $request->search) {
        $search = $request->search;
        $query->where(function($q) use ($search) {
            $q->where('borrower_name', 'LIKE', "%{$search}%")
              ->orWhereHas('inventory', function($sub) use ($search) {
                  $sub->where('name', 'LIKE', "%{$search}%");
              });
        });
    }
    
    $borrowRecords = $query->get();
    
    return response()->json([
        'success' => true,
        'data' => $borrowRecords
    ]);
}

    /**
     * Get all overdue items.
     */
    public function getOverdue()
    {
        $borrowRecords = BorrowRecord::with('inventory')
            ->where('status', 'overdue')
            ->latest('expected_return_date')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $borrowRecords
        ]);
    }

    /**
     * Get all available items.
     */
    public function getAvailable()
    {
        $items = Inventory::where('is_borrowable', true)
            ->where('quantity', '>', 0)
            ->get()
            ->filter(function ($item) {
                return $item->available_quantity > 0;
            })
            ->values();

        return response()->json([
            'success' => true,
            'data' => $items
        ]);
    }

    /**
     * Get inventory statistics.
     */
    public function getStatistics()
    {
        Inventory::ensureBuiltinCatalog();

        $totalItems = Inventory::count();
        $totalConsumables = Inventory::where('type', 'consumable')->count();

        // Borrow statistics from borrow_records
        $borrowedItems = BorrowRecord::whereIn('status', ['borrowed', 'overdue'])->count();
        $overdueItems = BorrowRecord::where('status', 'overdue')->count();
        $returnedItems = BorrowRecord::where('status', 'returned')->count();

        // Stock statistics from inventory
        $outOfStockItems = Inventory::where('quantity', '<=', 0)->count();
        $availableItems = Inventory::where('is_borrowable', true)
            ->where('quantity', '>', 0)
            ->get()
            ->filter(function ($item) {
                return $item->available_quantity > 0;
            })
            ->count();

        $totalQuantity = Inventory::sum('quantity');

        // Category statistics
        $categoryCounts = [];
        $categories = ['sacristy', 'church', 'office_supply', 'office_equipment'];
        foreach ($categories as $cat) {
            $categoryCounts[$cat] = Inventory::where('category', $cat)->count();
        }

        return response()->json([
            'success' => true,
            'data' => [
                'total_items' => $totalItems,
                'total_consumables' => $totalConsumables,
                'available_items' => $availableItems,
                'out_of_stock_items' => $outOfStockItems,
                'borrowed_items' => $borrowedItems,
                'overdue_items' => $overdueItems,
                'returned_items' => $returnedItems,
                'total_quantity' => $totalQuantity,
                'category_counts' => $categoryCounts, 
            ]
        ]);
    }

    /**
     * Search inventory items.
     */
    public function search(Request $request)
    {
        $query = $request->get('q');

        if (!$query) {
            return response()->json([
                'success' => false,
                'message' => 'Search query is required'
            ], 400);
        }

        $items = Inventory::where('name', 'LIKE', "%{$query}%")
            ->get();

        return response()->json([
            'success' => true,
            'data' => $items
        ]);
    }

    /**
     * Get borrow history for a specific item.
     */
    public function getBorrowHistory($id)
    {
        $item = Inventory::find($id);

        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found'
            ], 404);
        }

        $history = BorrowRecord::where('inventory_id', $id)
            ->latest('borrowed_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $history
        ]);
    }

    /**
     * Overall inventory movement history (stock in/out, new items, borrows, edits).
     */
    public function history(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'group' => 'nullable|in:all,' . implode(',', array_keys(InventoryHistory::GROUPS)),
            'inventory_id' => 'nullable|integer',
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date|after_or_equal:date_from',
            'search' => 'nullable|string|max:100',
            'per_page' => 'nullable|integer|min:1|max:100',
        ], [
            'date_to.after_or_equal' => 'The end date must be on or after the start date.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $base = InventoryHistory::query();

        if ($request->filled('inventory_id')) {
            $base->where('inventory_id', (int) $request->inventory_id);
        }
        if ($request->filled('date_from')) {
            $base->where('occurred_at', '>=', \Carbon\Carbon::parse($request->date_from)->startOfDay());
        }
        if ($request->filled('date_to')) {
            $base->where('occurred_at', '<=', \Carbon\Carbon::parse($request->date_to)->endOfDay());
        }
        if ($request->filled('search')) {
            $search = trim($request->search);
            $base->where(function ($q) use ($search) {
                $q->where('item_name', 'LIKE', "%{$search}%")
                    ->orWhere('notes', 'LIKE', "%{$search}%")
                    ->orWhere('details', 'LIKE', "%{$search}%");
            });
        }

        $summaryRows = (clone $base)
            ->selectRaw('action, COUNT(*) as total_rows, COALESCE(SUM(quantity_change), 0) as total_change')
            ->groupBy('action')
            ->get()
            ->keyBy('action');

        $count = fn (string $action) => (int) ($summaryRows[$action]->total_rows ?? 0);
        $sum = fn (string $action) => (int) ($summaryRows[$action]->total_change ?? 0);

        $summary = [
            'stock_in_qty' => $sum(InventoryHistory::ACTION_STOCK_IN),
            'stock_in_count' => $count(InventoryHistory::ACTION_STOCK_IN),
            'stock_out_qty' => abs($sum(InventoryHistory::ACTION_STOCK_OUT)),
            'stock_out_count' => $count(InventoryHistory::ACTION_STOCK_OUT),
            'new_items' => $count(InventoryHistory::ACTION_CREATED),
            'borrowed' => $count(InventoryHistory::ACTION_BORROWED),
            'returned' => $count(InventoryHistory::ACTION_RETURNED) + $count(InventoryHistory::ACTION_RETURNED_DAMAGED),
            'edits' => $count(InventoryHistory::ACTION_EDITED) + $count(InventoryHistory::ACTION_DELETED),
            'total' => (int) $summaryRows->sum('total_rows'),
        ];

        $group = $request->input('group', 'all');
        $query = clone $base;
        if ($group !== 'all' && isset(InventoryHistory::GROUPS[$group])) {
            $query->whereIn('action', InventoryHistory::GROUPS[$group]);
        }

        $perPage = (int) $request->input('per_page', 10);
        $rows = $query->with('performedBy:user_id,first_name,last_name,role')
            ->orderByDesc('occurred_at')
            ->orderByDesc('history_id')
            ->paginate($perPage);

        $rows->getCollection()->transform(fn (InventoryHistory $h) => [
            'history_id' => $h->history_id,
            'inventory_id' => $h->inventory_id,
            'item_name' => $h->item_name,
            'action' => $h->action,
            'action_label' => $h->action_label,
            'quantity_change' => $h->quantity_change,
            'quantity_before' => $h->quantity_before,
            'quantity_after' => $h->quantity_after,
            'borrow_record_id' => $h->borrow_record_id,
            'details' => $h->details,
            'notes' => $h->notes,
            'performed_by' => $h->performedBy
                ? trim($h->performedBy->first_name . ' ' . $h->performedBy->last_name)
                : null,
            'performed_by_role' => $h->performedBy?->role,
            'occurred_at' => $h->occurred_at?->toIso8601String(),
        ]);

        return response()->json([
            'success' => true,
            'data' => $rows,
            'summary' => $summary,
        ]);
    }

    private function recordUpdateHistory(Inventory $item, array $original, array $trackedFields, ?string $note): void
    {
        $item->refresh();
        $newQty = (int) $item->quantity;
        $oldQty = (int) $original['quantity'];

        if ($newQty !== $oldQty) {
            $diff = $newQty - $oldQty;
            InventoryHistory::record(
                $item,
                $diff > 0 ? InventoryHistory::ACTION_STOCK_IN : InventoryHistory::ACTION_STOCK_OUT,
                $diff,
                $oldQty,
                $newQty,
                ['notes' => $note]
            );
        }

        $labels = [
            'name' => 'Name',
            'type' => 'Type',
            'category' => 'Category',
            'is_borrowable' => 'Borrowable',
        ];

        $changes = [];
        foreach ($trackedFields as $field) {
            $before = $original[$field];
            $after = $field === 'is_borrowable' ? (bool) $item->is_borrowable : $item->{$field};
            if ((string) ($before ?? '') !== (string) ($after ?? '')) {
                $changes[] = [
                    'field' => $field,
                    'label' => $labels[$field] ?? $field,
                    'from' => $field === 'is_borrowable' ? ($before ? 'Yes' : 'No') : $before,
                    'to' => $field === 'is_borrowable' ? ($after ? 'Yes' : 'No') : $after,
                ];
            }
        }

        if (!empty($changes)) {
            InventoryHistory::record($item, InventoryHistory::ACTION_EDITED, 0, $newQty, $newQty, [
                'details' => ['changes' => $changes],
                'notes' => $newQty === $oldQty ? $note : null,
            ]);
        }
    }
}
