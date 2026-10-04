<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/**
 * Append-only record of every change to church records. Rows can be added but never edited or deleted.
 */
class ActivityLog extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'activity_logs';

    protected $primaryKey = 'log_id';

    protected $fillable = [
        'user_id',
        'user_name',
        'user_role',
        'action',
        'subject_type',
        'subject_id',
        'request_id',
        'description',
        'changes',
        'amount',
        'ip_address',
    ];

    protected $casts = [
        'changes' => 'array',
        'amount' => 'decimal:2',
        'created_at' => 'datetime',
    ];

    public const SUBJECT_LABELS = [
        'request' => 'Service request',
        'payment' => 'Service payment',
        'mass_collection' => 'Mass collection',
        'donation' => 'Donation',
        'special_intention' => 'Special intention',
        'expense' => 'Church expense',
        'reprint' => 'Certificate reprint',
        'certificate' => 'Certificate',
        'time_off' => 'Priest time off',
        'setting' => 'Setting',
    ];

    protected static function booted(): void
    {
        static::updating(function () {
            throw new LogicException('Activity log entries cannot be edited.');
        });

        static::deleting(function () {
            throw new LogicException('Activity log entries cannot be deleted.');
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    public function toApiArray(): array
    {
        return [
            'log_id' => $this->log_id,
            'created_at' => $this->created_at?->toIso8601String(),
            'user_name' => $this->user_name ?: 'System',
            'user_role' => $this->user_role,
            'action' => $this->action,
            'subject_type' => $this->subject_type,
            'subject_label' => self::SUBJECT_LABELS[$this->subject_type] ?? ucfirst(str_replace('_', ' ', $this->subject_type)),
            'subject_id' => $this->subject_id,
            'request_id' => $this->request_id,
            'description' => $this->description,
            'changes' => $this->changes,
            'amount' => $this->amount !== null ? (float) $this->amount : null,
        ];
    }
}
