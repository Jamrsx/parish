<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

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
        'is_builtin',
        'ran_out_at',
    ];

    protected $casts = [
        'is_borrowable' => 'boolean',
        'is_builtin' => 'boolean',
        'ran_out_at' => 'datetime',
    ];

    /**
     * Built-in parish catalog. Rows stay even when quantity is 0.
     */
    public static function builtinCatalog(): array
    {
        return [
            ['name' => 'Crucifix', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 5, 'is_borrowable' => false],
            ['name' => 'Paten', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 3, 'is_borrowable' => false],
            ['name' => 'Chalice', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 3, 'is_borrowable' => false],
            ['name' => 'Ciborium', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 2, 'is_borrowable' => false],
            ['name' => 'Pal', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 5, 'is_borrowable' => false],
            ['name' => 'Lavabo Bowl', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 2, 'is_borrowable' => false],
            ['name' => 'Monstrance', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 1, 'is_borrowable' => false],
            ['name' => 'Thurible', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 2, 'is_borrowable' => false],
            ['name' => 'Incense Boat', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 2, 'is_borrowable' => false],
            ['name' => 'Bells', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 2, 'is_borrowable' => false],
            ['name' => 'Candle', 'category' => 'sacristy', 'type' => 'consumable', 'quantity' => 50, 'is_borrowable' => false],
            ['name' => 'Lighter', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 5, 'is_borrowable' => false],
            ['name' => 'Cruets', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 4, 'is_borrowable' => false],
            ['name' => 'Credence Table', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 1, 'is_borrowable' => false],
            ['name' => 'Magic Charcoal', 'category' => 'sacristy', 'type' => 'consumable', 'quantity' => 20, 'is_borrowable' => false],
            ['name' => 'Offering Basket', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 3, 'is_borrowable' => false],
            ['name' => 'Roman Missal', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 2, 'is_borrowable' => false],
            ['name' => 'Lectionary', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 2, 'is_borrowable' => false],
            ['name' => 'Ritual for Priest', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 2, 'is_borrowable' => false],
            ['name' => 'Missalette', 'category' => 'sacristy', 'type' => 'consumable', 'quantity' => 30, 'is_borrowable' => false],
            ['name' => 'Chairs', 'category' => 'church', 'type' => 'item', 'quantity' => 100, 'is_borrowable' => true],
            ['name' => 'Foldable Table', 'category' => 'church', 'type' => 'item', 'quantity' => 10, 'is_borrowable' => true],
            ['name' => 'Portable Speaker', 'category' => 'church', 'type' => 'item', 'quantity' => 2, 'is_borrowable' => true],
            ['name' => 'Stand Fan', 'category' => 'church', 'type' => 'item', 'quantity' => 5, 'is_borrowable' => true],
            ['name' => 'Wine', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 20, 'is_borrowable' => false],
            ['name' => 'Host', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 200, 'is_borrowable' => false],
            ['name' => 'Incense Powder', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 10, 'is_borrowable' => false],
            ['name' => 'Chrism Oil', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 5, 'is_borrowable' => false],
            ['name' => 'Oleum Infirmorum', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 3, 'is_borrowable' => false],
            ['name' => 'Holy Water', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 15, 'is_borrowable' => false],
            ['name' => 'Purificator', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 30, 'is_borrowable' => false],
            ['name' => 'Corporal', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 20, 'is_borrowable' => false],
            ['name' => 'Bond Paper', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 500, 'is_borrowable' => false],
            ['name' => 'Ink', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 10, 'is_borrowable' => false],
            ['name' => 'Mass Intention Envelope', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 100, 'is_borrowable' => false],
            ['name' => 'Battery', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 50, 'is_borrowable' => false],
            ['name' => 'Pen', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 30, 'is_borrowable' => false],
            ['name' => 'Desktop Computer', 'category' => 'office_equipment', 'type' => 'item', 'quantity' => 3, 'is_borrowable' => false],
            ['name' => 'Printer', 'category' => 'office_equipment', 'type' => 'item', 'quantity' => 2, 'is_borrowable' => false],
            ['name' => 'Filing Cabinet', 'category' => 'office_equipment', 'type' => 'item', 'quantity' => 4, 'is_borrowable' => false],
            ['name' => 'Projector', 'category' => 'office_equipment', 'type' => 'item', 'quantity' => 1, 'is_borrowable' => false],
            ['name' => 'Chairs', 'category' => 'office_equipment', 'type' => 'item', 'quantity' => 15, 'is_borrowable' => false],
            ['name' => 'Tables', 'category' => 'office_equipment', 'type' => 'item', 'quantity' => 5, 'is_borrowable' => false],
        ];
    }

    /**
     * Insert missing catalog rows. Do not change quantity of existing rows.
     */
    public static function ensureBuiltinCatalog(): int
    {
        if (!Schema::hasColumn('inventory', 'is_builtin') || !Schema::hasColumn('inventory', 'ran_out_at')) {
            \Log::warning('Inventory catalog skipped: is_builtin or ran_out_at column missing');
            return 0;
        }

        $created = 0;

        foreach (self::builtinCatalog() as $row) {
            $existing = self::query()
                ->where('name', $row['name'])
                ->where('category', $row['category'])
                ->first();

            if ($existing) {
                if (!$existing->is_builtin) {
                    $existing->is_builtin = true;
                    $existing->save();
                }
                continue;
            }

            self::create(array_merge($row, ['is_builtin' => true]));
            $created++;
        }

        self::query()
            ->where('quantity', '<=', 0)
            ->whereNull('ran_out_at')
            ->update(['ran_out_at' => now()]);

        \Log::info('Inventory catalog ensured', [
            'created' => $created,
            'catalog_size' => count(self::builtinCatalog()),
        ]);

        return $created;
    }

    protected static function booted(): void
    {
        static::saving(function (Inventory $item) {
            if ((int) $item->quantity <= 0) {
                if (empty($item->ran_out_at)) {
                    $item->ran_out_at = now();
                }
            } else {
                $item->ran_out_at = null;
            }
        });
    }

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
