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
                     ->orWhere(function($q) {
                         $q->where('status', 'borrowed')
                           ->whereDate('expected_return_date', '<', now());
                     });
    }

    public function scopeReturned($query)
    {
        return $query->where('status', 'returned');
    }

    // Helper methods
    public function markAsReturned()
    {
        $this->update([
            'actual_return_date' => now(),
            'status' => 'returned',
        ]);

        // Update inventory quantity
        $this->inventory->increment('quantity', $this->quantity_borrowed);
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