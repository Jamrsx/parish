<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SpecialIntention extends Model
{
    public const MIN_OFFERING = 500.00;
    public const SOURCE_SECRETARY = 'secretary';
    public const SOURCE_PARISHIONER = 'parishioner';

    protected $primaryKey = 'intention_id';

    protected $fillable = [
        'user_id',
        'request_id',
        'parishioner_name',
        'intention_text',
        'amount',
        'denomination_breakdown',
        'intention_date',
        'notes',
        'source',
        'recorded_by',
        'status',
        'received_by',
        'received_at',
        'reject_reason',
    ];

    protected $casts = [
        'intention_date' => 'date',
        'amount' => 'decimal:2',
        'denomination_breakdown' => 'array',
        'received_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    public function manageRequest(): BelongsTo
    {
        return $this->belongsTo(ManageRequest::class, 'request_id', 'request_id');
    }

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

    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    public function scopeReceived($query)
    {
        return $query->where('status', 'received');
    }

    public function scopeAwaitingCashier($query)
    {
        return $query->where('status', 'approved');
    }

    public function scopeFromParishioner($query)
    {
        return $query->where('source', self::SOURCE_PARISHIONER);
    }

    /**
     * Create missing manage_requests for parishioner special intentions
     * so they appear under My Requests (e.g. submissions made before linking existed).
     */
    public static function linkMissingManageRequestsForUser(int $userId): int
    {
        $service = ChurchService::where('service_type', 'Special Intention')
            ->orWhere('form_handler', 'special_intention')
            ->first();

        if (!$service) {
            return 0;
        }

        $orphans = static::query()
            ->where('user_id', $userId)
            ->where('source', self::SOURCE_PARISHIONER)
            ->whereNull('request_id')
            ->get();

        $linked = 0;

        foreach ($orphans as $row) {
            try {
                \Illuminate\Support\Facades\DB::transaction(function () use ($row, $service, &$linked) {
                    $form = ServiceForm::create([
                        'service_id' => $service->service_id,
                        'full_name' => $row->parishioner_name,
                        'address' => $row->intention_text,
                        'contact_number' => 'N/A',
                        'preferred_date' => $row->intention_date?->format('Y-m-d') ?? now()->toDateString(),
                        'preferred_time' => '09:00:00',
                    ]);

                    $status = 'pending';
                    $paymentStatus = 'unpaid';
                    $amountPaid = 0;
                    $paymentDate = null;
                    $completedAt = null;
                    $cancelledReason = null;

                    if ($row->status === 'received') {
                        $status = 'done';
                        $paymentStatus = 'paid';
                        $amountPaid = (float) $row->amount;
                        $paymentDate = $row->received_at ?: now();
                        $completedAt = $row->received_at ?: now();
                    } elseif ($row->status === 'rejected') {
                        $status = 'cancelled';
                        $cancelledReason = $row->reject_reason
                            ? ('Special intention declined: ' . $row->reject_reason)
                            : 'Special intention declined.';
                    } elseif ($row->status === 'approved') {
                        $status = 'approved';
                    }

                    $manageRequest = ManageRequest::create([
                        'user_id' => $row->user_id,
                        'service_id' => $service->service_id,
                        'service_form_id' => $form->serviceform_id,
                        'preferred_date' => $row->intention_date?->format('Y-m-d') ?? now()->toDateString(),
                        'preferred_time' => '09:00:00',
                        'status' => $status,
                        'payment_status' => $paymentStatus,
                        'amount_paid' => $amountPaid,
                        'payment_date' => $paymentDate,
                        'completed_at' => $completedAt,
                        'cancelled_reason' => $cancelledReason,
                    ]);

                    $row->update(['request_id' => $manageRequest->request_id]);
                    $linked++;
                });
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::warning('Failed to link special intention to My Requests', [
                    'intention_id' => $row->intention_id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $linked;
    }
}
