<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChurchExpense extends Model
{
    protected $table = 'church_expenses';

    protected $primaryKey = 'expense_id';

    public const CATEGORIES = [
        'water_bill' => 'Water Bill',
        'electricity_bill' => 'Electricity Bill',
        'office_supply' => 'Office Supply',
        'maintenance' => 'Maintenance',
        'manpower' => 'Manpower',
        'fuel' => 'Fuel',
        'kitchen_supplies' => 'Kitchen Supplies',
        'allowance' => 'Allowance',
    ];

    /** Categories that cover a monthly bill and require billing_period */
    public const BILL_CATEGORIES = ['water_bill', 'electricity_bill'];

    /** Categories where the payee is required (none now; manpower/allowance names live in line_items) */
    public const PAYEE_REQUIRED_CATEGORIES = [];

    /** Itemized per person: each line is { name, amount } */
    public const PERSON_ITEM_CATEGORIES = ['manpower', 'allowance'];

    /** Itemized per product: each line is { name, quantity, unit_price, total } */
    public const PRODUCT_ITEM_CATEGORIES = ['office_supply', 'kitchen_supplies'];

    public const MAX_LINE_ITEMS = 50;

    public static function isItemized(?string $category): bool
    {
        return in_array($category, self::PERSON_ITEM_CATEGORIES, true)
            || in_array($category, self::PRODUCT_ITEM_CATEGORIES, true);
    }

    /** Statuses the secretary can still edit, delete, or forward */
    public const EDITABLE_STATUSES = ['draft', 'returned'];

    protected $fillable = [
        'category',
        'description',
        'payee_name',
        'amount',
        'line_items',
        'expense_date',
        'billing_period',
        'reference_no',
        'notes',
        'status',
        'recorded_by',
        'forwarded_at',
        'reviewed_by',
        'reviewed_at',
        'return_reason',
    ];

    protected $casts = [
        'expense_date' => 'date',
        'amount' => 'decimal:2',
        'line_items' => 'array',
        'forwarded_at' => 'datetime',
        'reviewed_at' => 'datetime',
    ];

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by', 'user_id');
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by', 'user_id');
    }

    public function scopeForwarded($query)
    {
        return $query->where('status', 'forwarded');
    }

    public function scopeVerified($query)
    {
        return $query->where('status', 'verified');
    }

    public function isEditable(): bool
    {
        return in_array($this->status, self::EDITABLE_STATUSES, true);
    }

    public function getCategoryLabelAttribute(): string
    {
        return self::CATEGORIES[$this->category] ?? ucfirst(str_replace('_', ' ', (string) $this->category));
    }
}
