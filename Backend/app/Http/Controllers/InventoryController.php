<?php

namespace App\Http\Controllers;

use App\Models\Inventory;
use App\Models\BorrowRecord;
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
        $query = Inventory::query();

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
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $item->update($request->all());

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

            // Create borrow record
            $borrowRecord = BorrowRecord::create([
                'inventory_id' => $item->inventory_id,
                'borrower_name' => $request->borrower_name,
                'borrower_phone' => $request->borrower_phone,
                'quantity_borrowed' => $request->quantity,
                'location' => $request->location,
                'borrowed_at' => now(),
                'expected_return_date' => $request->expected_return_date,
                'status' => 'borrowed',
            ]);

            // Update inventory quantity
            $item->decrement('quantity', $request->quantity);

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => $borrowRecord,
                'message' => 'Item borrowed successfully!'
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
     * Return a borrowed item.
     */
    public function returnItem($id)
    {
        $item = Inventory::find($id);

        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found'
            ], 404);
        }

        // Find active borrow record
        $borrowRecord = BorrowRecord::where('inventory_id', $id)
            ->whereIn('status', ['borrowed', 'overdue'])
            ->latest('borrowed_at')
            ->first();

        if (!$borrowRecord) {
            return response()->json([
                'success' => false,
                'message' => 'No active borrow record found for this item.'
            ], 400);
        }

        try {
            DB::beginTransaction();

            $borrowRecord->markAsReturned();

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => $borrowRecord,
                'message' => 'Item returned successfully!'
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
}
