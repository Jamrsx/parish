<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Inventory extends Model
{
    use HasFactory;

    protected $table = 'inventory';
    protected $primaryKey = 'inventory_id';
    public $incrementing = true;
    protected $keyType = 'int';

    protected $fillable = [
        'name',
        'quantity',
        'type',
        'category',
        'is_borrowable',
    ];

    protected $casts = [
        'is_borrowable' => 'boolean',
    ];

    // Relationships
    public function borrowRecords()
    {
        return $this->hasMany(BorrowRecord::class, 'inventory_id', 'inventory_id');
    }

    public function currentBorrowRecord()
    {
        return $this->hasOne(BorrowRecord::class, 'inventory_id', 'inventory_id')
            ->whereIn('status', ['borrowed', 'overdue'])
            ->latest('borrowed_at');
    }

    // Scopes
    public function scopeItems($query)
    {
        return $query->where('type', 'item');
    }

    public function scopeConsumables($query)
    {
        return $query->where('type', 'consumable');
    }

    public function scopeBorrowable($query)
    {
        return $query->where('is_borrowable', true);
    }

    public function scopeInStock($query)
    {
        return $query->where('quantity', '>', 0);
    }

    public function scopeOutOfStock($query)
    {
        return $query->where('quantity', '<=', 0);
    }

    // Helper methods
    public function getAvailableQuantityAttribute()
    {
        return $this->quantity;
    }

    public function isAvailable()
    {
        return $this->is_borrowable &&
            $this->quantity > 0 &&
            $this->available_quantity > 0;
    }

    public function isOutOfStock()
    {
        return $this->quantity <= 0;
    }

    public function getCurrentStatusAttribute()
    {
        $currentBorrow = $this->currentBorrowRecord;

        if ($currentBorrow) {
            return $currentBorrow->status;
        }

        if ($this->quantity <= 0) {
            return 'out_of_stock';
        }

        return 'available';
    }

    public function getDisplayStatusAttribute()
    {
        $status = $this->current_status;

        if ($status === 'out_of_stock') {
            return 'out of stock';
        }

        return $status;
    }

    //filtering by category
public function scopeCategory($query, $category)
{
    return $query->where('category', $category);
}

//get all unique categories
public static function getCategories()
{
    return self::distinct()->pluck('category')->filter()->values();
}
}
