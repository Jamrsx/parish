<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Log;

class ManageRequest extends Model
{
    protected $primaryKey = 'request_id';

    protected $fillable = [
        'user_id',
        'service_id',
        'processed_by',
        'assigned_priest',
        'baptism_form_id',
        'service_form_id',
        'certificate_form_id',
        'preferred_date',
        'preferred_time',
        'status',
        'cancelled_by',
        'cancelled_reason',
        'payment_status',
        'amount_paid',
        'payment_date',
        'approved_at',
        'completed_at',
        'rescheduled_by',
        'reschedule_reason',
    ];

    protected $casts = [
        'preferred_date' => 'date',
        'preferred_time' => 'datetime:H:i',
        'payment_date' => 'datetime',
        'approved_at' => 'datetime',
        'completed_at' => 'datetime',
        'amount_paid' => 'decimal:2',
    ];

    // ============ RELATIONSHIPS ============

    public function baptismForm(): BelongsTo
    {
        return $this->belongsTo(BaptismForm::class, 'baptism_form_id', 'baptism_id');
    }

    public function serviceForm(): BelongsTo
    {
        return $this->belongsTo(ServiceForm::class, 'service_form_id', 'serviceform_id');
    }

    public function certificateForm(): BelongsTo
    {
        return $this->belongsTo(CertificateForm::class, 'certificate_form_id', 'certificate_id');
    }

    public function getFormAttribute()
    {
        if ($this->baptism_form_id) {
            return $this->baptismForm;
        } elseif ($this->service_form_id) {
            return $this->serviceForm;
        } elseif ($this->certificate_form_id) {
            return $this->certificateForm;
        }
        return null;
    }

    public function getFormTypeAttribute(): ?string
    {
        if ($this->baptism_form_id) return 'baptism';
        if ($this->service_form_id) return 'service';
        if ($this->certificate_form_id) return 'certificate';
        return null;
    }

    public function getFormTypeLabelAttribute(): string
    {
        return match ($this->form_type) {
            'baptism' => 'Baptism',
            'service' => 'Service',
            'certificate' => 'Certificate',
            default => 'Unknown',
        };
    }

    public function getFormSummaryAttribute(): string
    {
        $form = $this->form;

        if (!$form) {
            return 'No form attached';
        }

        if ($form instanceof BaptismForm) {
            $middle = $form->child_middle_name ? ' ' . $form->child_middle_name : '';
            return "Baptism: {$form->child_first_name}{$middle} {$form->child_last_name}";
        }

        if ($form instanceof ServiceForm) {
            $serviceType = $form->churchService?->service_type ?? 'Service';
            return "{$serviceType}: {$form->full_name}";
        }

        if ($form instanceof CertificateForm) {
            $type = $form->churchService?->service_type ?? 'Certificate';
            return "{$type}: {$form->full_name}";
        }

        return 'Unknown Form';
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    public function processedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by', 'user_id');
    }

    public function assignedPriest(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_priest', 'user_id');
    }

    public function cancelledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by', 'user_id');
    }

    public function rescheduledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rescheduled_by', 'user_id');
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(ChurchService::class, 'service_id', 'service_id');
    }

    // ============ NOTIFICATION RELATIONSHIPS ============

    public function notifications()
    {
        return $this->hasMany(Notification::class, 'request_id', 'request_id');
    }

    // ============ ACCESSORS ============

    public function getStatusColorAttribute(): string
    {
        return match ($this->status) {
            'pending' => 'warning',
            'approved' => 'info',
            'done' => 'success',
            'cancelled' => 'danger',
            default => 'secondary',
        };
    }

    public function getPaymentStatusColorAttribute(): string
    {
        return match ($this->payment_status) {
            'unpaid' => 'danger',
            'partial' => 'warning',
            'paid' => 'success',
            default => 'secondary',
        };
    }

    public function getRemainingBalanceAttribute(): float
    {
        if (!$this->service) {
            return 0;
        }

        return max(0, $this->service->fee - $this->amount_paid);
    }

    public function getIsFullyPaidAttribute(): bool
    {
        return $this->payment_status === 'paid' || $this->remaining_balance <= 0;
    }

    public function getCanBeRescheduledAttribute(): bool
    {
        return in_array($this->status, ['pending', 'approved']) && $this->status !== 'done' && $this->status !== 'cancelled';
    }

    public function getRescheduleCountAttribute(): int
    {
        return $this->rescheduled_by ? 1 : 0;
    }

    // ============ SCOPES ============

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    public function scopeCompleted($query)
    {
        return $query->where('status', 'done');
    }

    public function scopeCancelled($query)
    {
        return $query->where('status', 'cancelled');
    }

    public function scopePaid($query)
    {
        return $query->where('payment_status', 'paid');
    }

    public function scopeUnpaid($query)
    {
        return $query->where('payment_status', 'unpaid');
    }

    public function scopeOfFormType($query, string $formType)
    {
        $column = match ($formType) {
            'baptism' => 'baptism_form_id',
            'service' => 'service_form_id',
            'certificate' => 'certificate_form_id',
            default => null,
        };

        if ($column) {
            return $query->whereNotNull($column);
        }
        return $query;
    }

    public function scopeDateBetween($query, $start, $end)
    {
        return $query->whereBetween('preferred_date', [$start, $end]);
    }

    // ============ HELPER METHODS ============

    public function canBeCancelled(): bool
    {
        return in_array($this->status, ['pending', 'approved']) && $this->status !== 'done';
    }

    public function canBeApproved(): bool
    {
        return $this->status === 'pending';
    }

    public function canBeCompleted(): bool
    {
        return $this->status === 'approved';
    }

    /**
     * Reschedule the request with notification
     */
    public function reschedule(array $data, $rescheduledBy = null): bool
    {
        if (!$this->can_be_rescheduled) {
            return false;
        }

        // Store old date/time for the notification message
        $oldDate = $this->preferred_date;
        $oldTime = $this->preferred_time;
        $oldFormattedDate = $oldDate ? date('F d, Y', strtotime($oldDate)) : 'N/A';
        $oldFormattedTime = $oldTime ? date('h:i A', strtotime($oldTime)) : 'N/A';
        $newFormattedDate = date('F d, Y', strtotime($data['preferred_date']));
        $newFormattedTime = date('h:i A', strtotime($data['preferred_time']));

        $updateData = [
            'preferred_date' => $data['preferred_date'],
            'preferred_time' => $data['preferred_time'],
            'reschedule_reason' => $data['reschedule_reason'] ?? null,
        ];

        if ($rescheduledBy) {
            $updateData['rescheduled_by'] = $rescheduledBy->user_id;
        }

        $this->update($updateData);

        // Update the associated form
        $form = $this->form;
        if ($form) {
            $form->update([
                'preferred_date' => $data['preferred_date'],
                'preferred_time' => $data['preferred_time'],
            ]);
        }

        // CREATE NOTIFICATION FOR RESCHEDULE
        $this->createRescheduleNotification(
            $oldFormattedDate,
            $oldFormattedTime,
            $newFormattedDate,
            $newFormattedTime,
            $data['reschedule_reason'] ?? null,
            $rescheduledBy
        );

        return true;
    }

    /**
     * Create notification for reschedule
     */
    public function createRescheduleNotification(
        string $oldDate,
        string $oldTime,
        string $newDate,
        string $newTime,
        ?string $reason = null,
        $rescheduledBy = null
    ) {
        $reschedulerName = $rescheduledBy
            ? $rescheduledBy->first_name . ' ' . $rescheduledBy->last_name
            : 'Admin';

        $message = "Your request has been rescheduled from {$oldDate} at {$oldTime} to {$newDate} at {$newTime}.";

        if ($reason) {
            $message .= " Reason: {$reason}";
        }

        return Notification::create([
            'user_id' => $this->user_id,
            'request_id' => $this->request_id,
            'type' => 'request_rescheduled',
            'title' => 'Request Rescheduled',
            'message' => $message
        ]);
    }

    //Now uses User instead of Admin
    public function cancel(string $reason, User $admin): bool
    {
        if (!$this->canBeCancelled()) {
            return false;
        }

        $this->update([
            'status' => 'cancelled',
            'cancelled_reason' => $reason,
            'cancelled_by' => $admin->user_id,
        ]);

        return true;
    }

    /**
     * System auto-cancel for expired pending requests (no admin user).
     */
    public function autoCancel(string $reason): bool
    {
        if ($this->status !== 'pending') {
            return false;
        }

        $oldStatus = $this->status;

        $this->update([
            'status' => 'cancelled',
            'cancelled_reason' => $reason,
            'cancelled_by' => null,
        ]);

        $this->createStatusNotification($oldStatus);

        return true;
    }

    public static function expiryMinutes(): int
    {
        return max(1, (int) env('REQUEST_EXPIRY_MINUTES', 60));
    }

    /**
     * Cancel pending requests older than the expiry window.
     */
    public static function expirePendingRequests(?int $userId = null): int
    {
        $minutes = static::expiryMinutes();
        $reason = "Automatically cancelled after {$minutes} minutes without approval.";

        $query = static::where('status', 'pending')
            ->where('created_at', '<=', now()->subMinutes($minutes));

        if ($userId !== null) {
            $query->where('user_id', $userId);
        }

        $expired = 0;

        foreach ($query->get() as $request) {
            if ($request->autoCancel($reason)) {
                $expired++;
                Log::info('Request auto-expired', [
                    'request_id' => $request->request_id,
                    'user_id' => $request->user_id,
                ]);
            }
        }

        return $expired;
    }

    //Now uses User instead of Admin
    public function approve(User $admin): bool
    {
        if (!$this->canBeApproved()) {
            return false;
        }

        $this->update([
            'status' => 'approved',
            'processed_by' => $admin->user_id,
            'approved_at' => now(),
        ]);

        return true;
    }

    public function complete(): bool
    {
        if (!$this->canBeCompleted()) {
            return false;
        }

        $this->update([
            'status' => 'done',
            'completed_at' => now(),
        ]);

        return true;
    }

    public function recordPayment(float $amount): bool
    {
        $newTotal = $this->amount_paid + $amount;
        $fee = $this->service->fee ?? 0;

        $status = $newTotal >= $fee ? 'paid' : 'partial';

        $this->update([
            'amount_paid' => $newTotal,
            'payment_status' => $status,
            'payment_date' => now(),
        ]);

        return true;
    }

    // ============ NOTIFICATION METHODS ============

    /**
     * Create notification for new request
     */
    public function createNewRequestNotification()
    {
        return Notification::create([
            'user_id' => $this->user_id,
            'request_id' => $this->request_id,
            'type' => 'request_pending',
            'title' => 'New Request Submitted',
            'message' => 'Your ' . $this->form_type_label . ' request has been submitted and is pending review.'
        ]);
    }

    /**
     * Create notification for status change
     */
    public function createStatusNotification($oldStatus = null)
    {
        if ($oldStatus === $this->status || $oldStatus === null) {
            return null;
        }

        $statusConfig = [
            'pending' => [
                'type' => 'request_pending',
                'title' => 'Request Pending',
                'message' => 'Your request is now pending review.'
            ],
            'approved' => [
                'type' => 'request_approved',
                'title' => 'Request Approved',
                'message' => 'Your request has been approved!'
            ],
            'done' => [
                'type' => 'request_completed',
                'title' => 'Request Completed',
                'message' => 'Your request has been completed.'
            ],
            'cancelled' => [
                'type' => 'request_cancelled',
                'title' => 'Request Cancelled',
                'message' => 'Your request has been cancelled.'
            ]
        ];

        $config = $statusConfig[$this->status] ?? [
            'type' => 'status_update',
            'title' => 'Request Update',
            'message' => 'Your request status has been updated to ' . ucfirst($this->status) . '.'
        ];

        // Add cancellation reason if applicable
        if ($this->status === 'cancelled' && $this->cancelled_reason) {
            $config['message'] .= ' Reason: ' . $this->cancelled_reason;
        }

        return Notification::create([
            'user_id' => $this->user_id,
            'request_id' => $this->request_id,
            'type' => $config['type'],
            'title' => $config['title'],
            'message' => $config['message']
        ]);
    }
}
