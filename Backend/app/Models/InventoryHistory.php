<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class InventoryHistory extends Model
{
    protected $table = 'inventory_histories';
    protected $primaryKey = 'history_id';

    public const ACTION_CREATED = 'created';
    public const ACTION_STOCK_IN = 'stock_in';
    public const ACTION_STOCK_OUT = 'stock_out';
    public const ACTION_BORROWED = 'borrowed';
    public const ACTION_RETURNED = 'returned';
    public const ACTION_RETURNED_DAMAGED = 'returned_damaged';
    public const ACTION_EDITED = 'edited';
    public const ACTION_DELETED = 'deleted';

    public const ACTION_LABELS = [
        self::ACTION_CREATED => 'New item',
        self::ACTION_STOCK_IN => 'Stock in',
        self::ACTION_STOCK_OUT => 'Stock out',
        self::ACTION_BORROWED => 'Borrowed',
        self::ACTION_RETURNED => 'Returned',
        self::ACTION_RETURNED_DAMAGED => 'Returned (damaged)',
        self::ACTION_EDITED => 'Edited',
        self::ACTION_DELETED => 'Deleted',
    ];

    /** Filter groups shown as buttons in the UI */
    public const GROUPS = [
        'stock_in' => [self::ACTION_STOCK_IN],
        'stock_out' => [self::ACTION_STOCK_OUT],
        'new' => [self::ACTION_CREATED],
        'borrow' => [self::ACTION_BORROWED, self::ACTION_RETURNED, self::ACTION_RETURNED_DAMAGED],
        'edits' => [self::ACTION_EDITED, self::ACTION_DELETED],
    ];

    protected $fillable = [
        'inventory_id',
        'item_name',
        'action',
        'quantity_change',
        'quantity_before',
        'quantity_after',
        'borrow_record_id',
        'details',
        'notes',
        'performed_by',
        'occurred_at',
    ];

    protected $casts = [
        'quantity_change' => 'integer',
        'quantity_before' => 'integer',
        'quantity_after' => 'integer',
        'details' => 'array',
        'occurred_at' => 'datetime',
    ];

    public function inventory()
    {
        return $this->belongsTo(Inventory::class, 'inventory_id', 'inventory_id');
    }

    public function performedBy()
    {
        return $this->belongsTo(User::class, 'performed_by', 'user_id');
    }

    public function getActionLabelAttribute(): string
    {
        return self::ACTION_LABELS[$this->action] ?? ucfirst(str_replace('_', ' ', $this->action));
    }

    /**
     * Record an inventory event. Failures are logged and never break the main action.
     */
    public static function record(
        Inventory $item,
        string $action,
        int $quantityChange = 0,
        ?int $quantityBefore = null,
        ?int $quantityAfter = null,
        array $extra = []
    ): ?self {
        try {
            if (!Schema::hasTable('inventory_histories')) {
                return null;
            }

            $performedBy = array_key_exists('performed_by', $extra)
                ? $extra['performed_by']
                : auth('sanctum')->id();

            return self::create([
                'inventory_id' => $item->inventory_id,
                'item_name' => (string) $item->name,
                'action' => $action,
                'quantity_change' => $quantityChange,
                'quantity_before' => $quantityBefore,
                'quantity_after' => $quantityAfter,
                'borrow_record_id' => $extra['borrow_record_id'] ?? null,
                'details' => $extra['details'] ?? null,
                'notes' => $extra['notes'] ?? null,
                'performed_by' => $performedBy,
                'occurred_at' => now(),
            ]);
        } catch (\Throwable $e) {
            Log::error('Inventory history record failed: ' . $e->getMessage(), [
                'inventory_id' => $item->inventory_id,
                'action' => $action,
            ]);
            return null;
        }
    }
}
