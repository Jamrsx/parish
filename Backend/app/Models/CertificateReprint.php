<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CertificateReprint extends Model
{
    public const STATUS_AWAITING_PAYMENT = 'awaiting_payment';
    public const STATUS_PAID = 'paid';
    public const STATUS_RELEASED = 'released';
    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [
        self::STATUS_AWAITING_PAYMENT,
        self::STATUS_PAID,
        self::STATUS_RELEASED,
        self::STATUS_CANCELLED,
    ];

    protected $primaryKey = 'reprint_id';

    protected $fillable = [
        'issued_certificate_id',
        'person_name',
        'certificate_type',
        'amount',
        'reason',
        'status',
        'requested_by',
        'paid_by',
        'paid_at',
        'or_number',
        'payment_notes',
        'released_by',
        'released_at',
        'cancelled_by',
        'cancelled_at',
        'cancel_reason',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'paid_at' => 'datetime',
        'released_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    public function issuedCertificate(): BelongsTo
    {
        return $this->belongsTo(IssuedCertificate::class, 'issued_certificate_id', 'issued_certificate_id');
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by', 'user_id');
    }

    public function paidBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by', 'user_id');
    }

    public function releasedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'released_by', 'user_id');
    }

    public function cancelledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by', 'user_id');
    }

    /** Paid reprint fees count as income (paid or already released). */
    public function scopeIncome($query)
    {
        return $query->whereIn('status', [self::STATUS_PAID, self::STATUS_RELEASED])->whereNotNull('paid_at');
    }

    /**
     * Reprints of the same person's certificate of this type that were not cancelled.
     * The person is matched by name (case and extra spaces ignored).
     */
    public static function forPerson(?string $personName, ?string $certificateType)
    {
        return static::query()
            ->whereRaw('LOWER(TRIM(person_name)) = ?', [mb_strtolower(trim((string) $personName))])
            ->where('certificate_type', $certificateType)
            ->where('status', '!=', self::STATUS_CANCELLED);
    }

    /** Total reprints for this person and certificate type (not counting cancelled ones). */
    public static function countForPerson(?string $personName, ?string $certificateType): int
    {
        return static::forPerson($personName, $certificateType)->count();
    }

    /** This reprint's position for its person: 1 = first reprint. Null when it was cancelled. */
    public function personReprintNumber(): ?int
    {
        if ($this->status === self::STATUS_CANCELLED) {
            return null;
        }

        return static::forPerson($this->person_name, $this->certificate_type)
            ->where(function ($q) {
                $q->where('created_at', '<', $this->created_at)
                    ->orWhere(fn ($t) => $t->where('created_at', $this->created_at)->where('reprint_id', '<=', $this->reprint_id));
            })
            ->count();
    }
}
