<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BorrowRecord extends Model
{
    use HasFactory;

    protected $table = 'borrow_records';
    protected $primaryKey = 'borrow_record_id';

    protected $fillable = [
        'inventory_id',
        'borrower_name',
        'borrower_phone',
        'quantity_borrowed',
        'quantity_damaged',
        'damage_notes',
        'location',
        'borrowed_at',
        'expected_return_date',
        'actual_return_date',
        'status',
    ];

    protected $casts = [
        'borrowed_at' => 'date',
        'expected_return_date' => 'date',
        'actual_return_date' => 'date',
        'quantity_borrowed' => 'integer',
        'quantity_damaged' => 'integer',
    ];

    // Relationships
    public function inventory()
    {
        return $this->belongsTo(Inventory::class, 'inventory_id', 'inventory_id');
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->whereIn('status', ['borrowed', 'overdue']);
    }

    public function scopeOverdue($query)
    {
        return $query->where('status', 'overdue')
                     ->orWhere(function ($q) {
                         $q->where('status', 'borrowed')
                           ->whereDate('expected_return_date', '<', now());
                     });
    }

    public function scopeReturned($query)
    {
        return $query->where('status', 'returned');
    }

    /**
     * Mark as returned. Damaged units are not restored to inventory stock.
     */
    public function markAsReturned(int $quantityDamaged = 0, ?string $damageNotes = null): void
    {
        $borrowed = max(1, (int) $this->quantity_borrowed);
        $damaged = max(0, min($quantityDamaged, $borrowed));
        $good = $borrowed - $damaged;

        $inventory = Inventory::where('inventory_id', $this->inventory_id)
            ->lockForUpdate()
            ->first();

        if (!$inventory) {
            throw new \RuntimeException('Inventory item not found for this borrow record.');
        }

        $this->update([
            'actual_return_date' => now(),
            'status' => 'returned',
            'quantity_damaged' => $damaged,
            'damage_notes' => $damaged > 0 ? $damageNotes : null,
        ]);

        // Only good (undamaged) units go back into available stock
        if ($good > 0) {
            $before = (int) $inventory->quantity;
            $inventory->quantity = $before + $good;
            $inventory->save();

            \Log::info('Borrow return restored stock', [
                'borrow_record_id' => $this->borrow_record_id,
                'inventory_id' => $inventory->inventory_id,
                'quantity_before' => $before,
                'quantity_restored' => $good,
                'quantity_damaged' => $damaged,
                'quantity_after' => (int) $inventory->quantity,
            ]);
        } else {
            \Log::info('Borrow return — all units damaged, stock unchanged', [
                'borrow_record_id' => $this->borrow_record_id,
                'inventory_id' => $this->inventory_id,
                'quantity_damaged' => $damaged,
                'stock_on_hand' => (int) $inventory->quantity,
            ]);
        }
    }

    public function isOverdue()
    {
        return $this->status === 'overdue' ||
               ($this->status === 'borrowed' && $this->expected_return_date < now());
    }

    public function getDaysOverdueAttribute()
    {
        if (!$this->isOverdue()) {
            return 0;
        }

        return now()->diffInDays($this->expected_return_date);
    }
}
