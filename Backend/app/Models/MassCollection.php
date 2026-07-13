<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MassCollection extends Model
{
    protected $primaryKey = 'collection_id';

    protected $fillable = [
        'mass_date',
        'mass_type',
        'mass_time',
        'amount',
        'denomination_breakdown',
        'recorded_by',
        'notes',
        'status',
        'received_by',
        'received_at',
        'reject_reason',
    ];

    protected $casts = [
        'mass_date' => 'date',
        'amount' => 'decimal:2',
        'denomination_breakdown' => 'array',
        'received_at' => 'datetime',
    ];

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by', 'user_id');
    }

    public function receivedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by', 'user_id');
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeReceived($query)
    {
        return $query->where('status', 'received');
    }
}
