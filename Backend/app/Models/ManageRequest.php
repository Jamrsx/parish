<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Cache;
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
        'is_resident',
        'payment_status',
        'amount_paid',
        'payment_date',
        'approved_at',
        'completed_at',
        'completed_by',
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
        'is_resident' => 'boolean',
    ];

    /** Human-readable reference code, e.g. REQ-000042 */
    public static function formatRequestReference(int $requestId): string
    {
        return 'REQ-' . str_pad((string) $requestId, 6, '0', STR_PAD_LEFT);
    }

    /** Parse REQ-000042 or plain numeric search into request_id */
    public static function resolveSearchRequestId(?string $search): ?int
    {
        if ($search === null || trim($search) === '') {
            return null;
        }

        $trimmed = trim($search);
        if (preg_match('/^REQ-?(\d+)$/i', $trimmed, $matches)) {
            return (int) $matches[1];
        }

        if (ctype_digit($trimmed)) {
            return (int) $trimmed;
        }

        return null;
    }

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
        if ($this->certificate_form_id) return 'certificate';
        if ($this->service_form_id) {
            $service = $this->relationLoaded('service') ? $this->service : $this->service()->first();
            if (
                $service && (
                    $service->form_handler === 'special_intention' ||
                    $service->service_type === 'Special Intention'
                )
            ) {
                return 'special_intention';
            }
            return 'service';
        }
        return null;
    }

    public function getFormTypeLabelAttribute(): string
    {
        return match ($this->form_type) {
            'baptism' => 'Baptism',
            'service' => 'Church Service',
            'certificate' => 'Certificate',
            'special_intention' => 'Special Intention',
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
            if ($serviceType === 'Special Intention' || $form->churchService?->form_handler === 'special_intention') {
                $intention = \Illuminate\Support\Str::limit((string) $form->address, 90);
                return "Special Intention: {$form->full_name} — {$intention}";
            }
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

    /** Secretary or priest who marked the service as completed */
    public function completedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by', 'user_id');
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

    public function paymentTransactions()
    {
        return $this->hasMany(PaymentTransaction::class, 'request_id', 'request_id');
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

    public function scopeBlockingSchedule($query)
    {
        // Only church services (baptism, wedding, etc.) compete for parish time slots.
        // Certificates (and special intentions) keep preferred times for visit/pickup
        // and must not block or be blocked by service bookings.
        return static::onlyScheduledServices($query->whereIn('status', self::blockingStatuses()));
    }

    /**
     * Requests that keep their time slot taken for booking purposes.
     * Once a time has been booked (approved), it stays unavailable for that day even if the
     * booking is later completed or cancelled, so the parish keeps its preparation time.
     * A request cancelled while still pending (never approved) frees the slot.
     */
    public function scopeHoldingTimeSlot($query)
    {
        return static::onlyScheduledServices($query->where(function ($q) {
            $q->whereIn('status', self::blockingStatuses())
                ->orWhere('status', 'done')
                ->orWhere(fn ($c) => $c->where('status', 'cancelled')->whereNotNull('approved_at'));
        }));
    }

    private static function onlyScheduledServices($query)
    {
        return $query->whereNull('certificate_form_id')
            ->whereDoesntHave('service', function ($q) {
                $q->where('category', 'certificate')
                    ->orWhere('form_handler', 'special_intention')
                    ->orWhere('service_type', 'Special Intention')
                    ->orWhere('service_type', 'like', '%Certificate%');
            });
    }

    // ============ GLOBAL SCHEDULE CONFLICTS ============

    public static function blockingStatuses(): array
    {
        return ['pending', 'approved'];
    }

    public static function normalizeTime($time): string
    {
        if ($time instanceof Carbon) {
            return $time->format('H:i');
        }

        if (empty($time)) {
            return '';
        }

        try {
            return Carbon::parse($time)->format('H:i');
        } catch (\Exception $e) {
            return substr((string) $time, 0, 5);
        }
    }

    public static function isTimeSlotTakenGlobally(
        string $date,
        string $time,
        ?int $excludeRequestId = null,
        ?ChurchService $service = null
    ): bool {
        $needed = self::occupiedSlots($time, $service);

        if ($needed === []) {
            return false;
        }

        return array_intersect($needed, self::getBookedTimeSlotsForDate($date, $excludeRequestId)) !== [];
    }

    /** Every hourly slot in use on a date. A Marriage or Funeral Mass fills its whole 5-hour block. */
    public static function getBookedTimeSlotsForDate(string $date, ?int $excludeRequestId = null): array
    {
        $query = static::query()
            ->with('service')
            ->whereDate('preferred_date', $date)
            ->holdingTimeSlot();

        if ($excludeRequestId) {
            $query->where('request_id', '!=', $excludeRequestId);
        }

        return $query->get()
            ->flatMap(fn (self $request) => self::occupiedSlots($request->preferred_time, $request->service))
            ->unique()
            ->values()
            ->all();
    }

    public static function validateGlobalSchedule(
        string $date,
        string $time,
        ?int $excludeRequestId = null,
        ?ChurchService $service = null
    ): ?string {
        if (self::isLongService($service) && !isset(self::LONG_SERVICE_BLOCKS[self::normalizeTime($time)])) {
            return 'Marriage and Funeral Mass can only start at 8:00 AM or 1:00 PM.';
        }

        if (self::isPastSlot($date, $time)) {
            return 'That time has already passed. Please choose a later time.';
        }

        if (self::isTimeSlotTakenGlobally($date, $time, $excludeRequestId, $service)) {
            return 'The selected time slot is already booked. Please choose another time.';
        }

        return null;
    }

    /** Hourly service slots offered by the parish (must match the web and mobile time lists). */
    public const SERVICE_TIME_SLOTS = [
        '08:00', '09:00', '10:00', '11:00', '12:00',
        '13:00', '14:00', '15:00', '16:00', '17:00',
    ];

    /** Services that take a 5-hour block instead of one hourly slot. */
    public const LONG_SERVICE_HANDLERS = ['marriage', 'funeral_mass'];

    /** 5-hour blocks, keyed by start time (must match the web and mobile time lists). */
    public const LONG_SERVICE_BLOCKS = [
        '08:00' => ['08:00', '09:00', '10:00', '11:00', '12:00'],
        '13:00' => ['13:00', '14:00', '15:00', '16:00', '17:00'],
    ];

    public static function isLongService(?ChurchService $service): bool
    {
        return in_array((string) $service?->form_handler, self::LONG_SERVICE_HANDLERS, true);
    }

    /** Start of the 5-hour block containing $time, or null when it is outside every block. */
    public static function blockStartFor($time): ?string
    {
        $normalizedTime = self::normalizeTime($time);

        foreach (self::LONG_SERVICE_BLOCKS as $start => $slots) {
            if (in_array($normalizedTime, $slots, true)) {
                return $start;
            }
        }

        return null;
    }

    /** Hourly slots a booking uses: its whole block for a long service, otherwise its own time. */
    public static function occupiedSlots($time, ?ChurchService $service = null): array
    {
        $normalizedTime = self::normalizeTime($time);

        if ($normalizedTime === '') {
            return [];
        }

        $blockStart = self::isLongService($service) ? self::blockStartFor($normalizedTime) : null;

        return $blockStart ? self::LONG_SERVICE_BLOCKS[$blockStart] : [$normalizedTime];
    }

    public static function isPastSlot(string $date, string $time): bool
    {
        $normalizedTime = self::normalizeTime($time);
        if ($normalizedTime === '') {
            return false;
        }

        try {
            return Carbon::parse("{$date} {$normalizedTime}")->lessThanOrEqualTo(Carbon::now());
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Dates between $from and $to (inclusive) where every service time slot is already booked.
     *
     * @return string[] Y-m-d dates
     */
    public static function getFullyBookedDates(string $from, string $to): array
    {
        $slotCount = count(self::SERVICE_TIME_SLOTS);

        return static::query()
            ->with('service')
            ->whereDate('preferred_date', '>=', $from)
            ->whereDate('preferred_date', '<=', $to)
            ->holdingTimeSlot()
            ->get(['request_id', 'service_id', 'preferred_date', 'preferred_time'])
            ->groupBy(fn (self $request) => Carbon::parse($request->preferred_date)->format('Y-m-d'))
            ->filter(function ($requests) use ($slotCount) {
                $taken = $requests
                    ->flatMap(fn (self $request) => self::occupiedSlots($request->preferred_time, $request->service))
                    ->filter(fn ($time) => in_array($time, self::SERVICE_TIME_SLOTS, true))
                    ->unique()
                    ->count();

                return $taken >= $slotCount;
            })
            ->keys()
            ->sort()
            ->values()
            ->all();
    }

    /**
     * Runs $callback while holding a lock on one date + time, so two people cannot
     * pass the "slot is free" check at the same moment and both save.
     * Returns null when the lock could not be obtained in time.
     */
    public static function withScheduleLock(string $date, string $time, callable $callback)
    {
        // Lock the whole block, so an hourly booking and a 5-hour booking cannot overlap.
        $key = 'schedule-slot:' . $date . ':' . (self::blockStartFor($time) ?? self::normalizeTime($time));

        try {
            return Cache::lock($key, 15)->block(5, $callback);
        } catch (LockTimeoutException $e) {
            Log::warning('Schedule lock timeout', ['date' => $date, 'time' => $time]);
            return null;
        }
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
     * True when a service has not reached its scheduled date and time yet.
     * Certificates are exempt because they can be issued before the visit time.
     */
    public function isBeforeScheduledTime(): bool
    {
        $this->loadMissing('service');

        $isCertificate = !empty($this->certificate_form_id)
            || $this->service?->category === 'certificate'
            || str_contains(strtolower((string) $this->service?->service_type), 'certificate');

        if ($isCertificate || !$this->preferred_date || !$this->preferred_time) {
            return false;
        }

        return !self::isPastSlot(
            Carbon::parse($this->preferred_date)->toDateString(),
            (string) $this->preferred_time
        );
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

        $message = $this->notificationRequestPhrase(false) . " has been rescheduled from {$oldDate} at {$oldTime} to {$newDate} at {$newTime}.";

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

        SpecialIntention::where('request_id', $this->request_id)
            ->whereIn('status', ['pending', 'approved'])
            ->get()
            ->each(fn (SpecialIntention $row) => $row->update([
                'status' => 'rejected',
                'reject_reason' => 'Request cancelled: ' . $reason,
            ]));

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
     * Whether pending requests are cancelled automatically once past their deadline.
     * Off by default: overdue requests stay pending and are flagged for the secretary instead.
     * Set REQUEST_AUTO_CANCEL=true in .env to turn automatic cancelling back on.
     */
    public static function autoCancelEnabled(): bool
    {
        return filter_var(env('REQUEST_AUTO_CANCEL', false), FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * Cancel pending requests older than the expiry window.
     */
    /** True for special intentions, which never auto-expire. */
    public function isSpecialIntention(): bool
    {
        $this->loadMissing('service');
        return $this->service?->form_handler === 'special_intention'
            || $this->service?->service_type === 'Special Intention';
    }

    /**
     * Response deadline of a pending request (submitted time + REQUEST_EXPIRY_MINUTES), or null when it has none
     * (not pending, or a special intention). Past it, the request is overdue (or auto-cancelled when that is on).
     */
    public function expiresAt(): ?Carbon
    {
        if ($this->status !== 'pending' || !$this->created_at || $this->isSpecialIntention()) {
            return null;
        }

        return $this->created_at->copy()->addMinutes(static::expiryMinutes());
    }

    public static function expirePendingRequests(?int $userId = null): int
    {
        if (!static::autoCancelEnabled()) {
            return 0;
        }

        $minutes = static::expiryMinutes();
        $reason = "Automatically cancelled after {$minutes} minutes without approval.";

        $query = static::where('status', 'pending')
            ->where('created_at', '<=', now()->subMinutes($minutes))
            ->whereDoesntHave('service', function ($q) {
                $q->where('form_handler', 'special_intention')
                    ->orWhere('service_type', 'Special Intention');
            });

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

        // Keep Special Intention handover in sync so cashier can see it.
        $this->syncLinkedSpecialIntentionOnApprove();

        return true;
    }

    public function complete(?User $by = null): bool
    {
        if (!$this->canBeCompleted()) {
            return false;
        }

        $this->update([
            'status' => 'done',
            'completed_at' => now(),
            'completed_by' => $by?->user_id,
        ]);

        return true;
    }

    /**
     * When a linked manage_request is approved (Manage Requests / Special Intentions),
     * mark the special_intentions row as approved for the cashier queue.
     */
    public function syncLinkedSpecialIntentionOnApprove(): void
    {
        SpecialIntention::where('request_id', $this->request_id)
            ->where('status', 'pending')
            ->get()
            ->each(fn (SpecialIntention $row) => $row->update([
                'status' => 'approved',
                'reject_reason' => null,
            ]));
    }

    public function recordPayment(float $amount, ?User $receivedBy = null, ?string $orNumber = null, ?string $notes = null): bool
    {
        $newTotal = $this->amount_paid + $amount;
        $fee = $this->service->fee ?? 0;

        $status = $newTotal >= $fee ? 'paid' : 'partial';

        $this->update([
            'amount_paid' => $newTotal,
            'payment_status' => $status,
            'payment_date' => now(),
        ]);

        if ($receivedBy) {
            PaymentTransaction::create([
                'request_id' => $this->request_id,
                'received_by' => $receivedBy->user_id,
                'amount' => $amount,
                'or_number' => $orNumber,
                'notes' => $notes,
            ]);
        }

        return true;
    }

    // ============ NOTIFICATION METHODS ============

    public function notificationServiceLabel(): string
    {
        $this->loadMissing('service');
        $name = trim((string) ($this->service?->service_type ?? ''));
        if ($name !== '') {
            return $name;
        }
        $label = $this->form_type_label;
        return $label !== 'Unknown' ? $label : 'church service';
    }

    public function notificationScheduleLabel(): ?string
    {
        if (!$this->preferred_date) {
            return null;
        }
        $date = \Carbon\Carbon::parse($this->preferred_date)->format('M d, Y');
        $time = self::normalizeTime($this->preferred_time);
        return $time !== '' ? $date . ' at ' . date('g:i A', strtotime($time)) : $date;
    }

    private function notificationRequestPhrase(bool $withSchedule = true): string
    {
        $phrase = 'Your ' . $this->notificationServiceLabel() . ' request';
        $schedule = $withSchedule ? $this->notificationScheduleLabel() : null;
        return $schedule ? $phrase . ' for ' . $schedule : $phrase;
    }

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
            'message' => $this->notificationRequestPhrase() . ' has been submitted and is pending review.'
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

        $withSchedule = $this->notificationRequestPhrase();
        $withoutSchedule = $this->notificationRequestPhrase(false);

        $statusConfig = [
            'pending' => [
                'type' => 'request_pending',
                'title' => 'Request Pending',
                'message' => $withSchedule . ' is now pending review.'
            ],
            'approved' => [
                'type' => 'request_approved',
                'title' => 'Request Approved',
                'message' => $withSchedule . ' has been approved!'
            ],
            'done' => [
                'type' => 'request_completed',
                'title' => 'Request Completed',
                'message' => $withoutSchedule . ' has been completed.'
            ],
            'cancelled' => [
                'type' => 'request_cancelled',
                'title' => 'Request Cancelled',
                'message' => $withSchedule . ' has been cancelled.'
            ]
        ];

        $config = $statusConfig[$this->status] ?? [
            'type' => 'status_update',
            'title' => 'Request Update',
            'message' => $withoutSchedule . ' status has been updated to ' . ucfirst($this->status) . '.'
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

    /**
     * Notify priest when they are assigned to a service.
     */
    public function createPriestAssignmentNotification(User $priest)
    {
        $this->loadMissing(['service', 'user']);

        $serviceName = $this->service?->service_type ?? $this->form_type_label ?? 'Church Service';
        $date = $this->preferred_date
            ? \Carbon\Carbon::parse($this->preferred_date)->format('M d, Y')
            : 'TBA';
        $time = self::normalizeTime($this->preferred_time);
        $timeLabel = $time !== ''
            ? date('g:i A', strtotime($time))
            : 'TBA';
        $parishioner = $this->user?->full_name ?? 'a parishioner';

        return Notification::create([
            'user_id' => $priest->user_id,
            'request_id' => $this->request_id,
            'type' => 'priest_assigned',
            'title' => 'New Service Assignment',
            'message' => "You have been assigned to {$serviceName} for {$parishioner} on {$date} at {$timeLabel}.",
        ]);
    }

    /**
     * Create a one-time upcoming reminder for the assigned priest (within next 24 hours).
     */
    public function ensurePriestUpcomingReminder(): ?Notification
    {
        if (!$this->assigned_priest) {
            return null;
        }

        if (!in_array($this->status, ['pending', 'approved'], true)) {
            return null;
        }

        if (!$this->preferred_date) {
            return null;
        }

        $time = self::normalizeTime($this->preferred_time) ?: '09:00';
        $eventAt = \Carbon\Carbon::parse(
            \Carbon\Carbon::parse($this->preferred_date)->format('Y-m-d') . ' ' . $time
        );
        $hoursUntil = now()->diffInHours($eventAt, false);

        // Upcoming within the next 24 hours (future events only)
        if ($hoursUntil < 0 || $hoursUntil > 24) {
            return null;
        }

        $alreadyNotified = Notification::where('user_id', $this->assigned_priest)
            ->where('request_id', $this->request_id)
            ->where('type', 'priest_upcoming')
            ->where('created_at', '>=', now()->subDay())
            ->exists();

        if ($alreadyNotified) {
            return null;
        }

        $this->loadMissing(['service', 'user']);
        $serviceName = $this->service?->service_type ?? $this->form_type_label ?? 'Church Service';
        $parishioner = $this->user?->full_name ?? 'a parishioner';
        $when = $eventAt->format('M d, Y g:i A');

        return Notification::create([
            'user_id' => $this->assigned_priest,
            'request_id' => $this->request_id,
            'type' => 'priest_upcoming',
            'title' => 'Upcoming Service Reminder',
            'message' => "Upcoming: {$serviceName} for {$parishioner} on {$when}.",
        ]);
    }

    /**
     * Sync upcoming reminders for all active assignments of a priest.
     */
    public static function syncPriestUpcomingReminders(int $priestId): int
    {
        $count = 0;
        $rows = static::where('assigned_priest', $priestId)
            ->whereIn('status', ['pending', 'approved'])
            ->whereDate('preferred_date', '>=', now()->toDateString())
            ->whereDate('preferred_date', '<=', now()->addDay()->toDateString())
            ->get();

        foreach ($rows as $row) {
            if ($row->ensurePriestUpcomingReminder()) {
                $count++;
            }
        }

        return $count;
    }

    // ============ PARISHIONER DAY-BEFORE REMINDERS ============

    /** Day-before reminders are shown from 8:00 AM and discarded at 9:00 PM (app timezone). */
    public const SERVICE_REMINDER_TYPE = 'service_reminder';
    public const SERVICE_REMINDER_START_HOUR = 8;
    public const SERVICE_REMINDER_END_HOUR = 21;

    public static function serviceReminderWindowOpen(?\Carbon\Carbon $now = null): bool
    {
        $hour = ($now ?? now())->hour;
        return $hour >= self::SERVICE_REMINDER_START_HOUR && $hour < self::SERVICE_REMINDER_END_HOUR;
    }

    /**
     * Remove day-before reminders that should no longer show: made on an earlier day,
     * past 9:00 PM, or the booking was cancelled, completed or moved off tomorrow.
     * Includes reminders the parishioner already deleted, so nothing lingers in their trash.
     */
    public static function discardStaleServiceReminders(?int $userId = null): int
    {
        $now = now();
        $tomorrow = $now->copy()->addDay()->toDateString();
        $windowOpen = static::serviceReminderWindowOpen($now);

        $query = Notification::withTrashed()
            ->where('type', self::SERVICE_REMINDER_TYPE)
            ->where(function ($q) use ($now, $tomorrow, $windowOpen) {
                if (!$windowOpen) {
                    $q->whereRaw('1 = 1');
                    return;
                }
                $q->where('created_at', '<', $now->copy()->startOfDay())
                    ->orWhereNull('request_id')
                    ->orWhereDoesntHave('request', function ($r) use ($tomorrow) {
                        $r->where('status', 'approved')->whereDate('preferred_date', $tomorrow);
                    });
            });

        if ($userId !== null) {
            $query->where('user_id', $userId);
        }

        return $query->forceDelete();
    }

    /**
     * Send each parishioner one reminder per booked (approved) service that is tomorrow.
     * Runs when the parishioner opens notifications and from the scheduled command.
     */
    public static function syncServiceReminders(?int $userId = null): int
    {
        static::discardStaleServiceReminders($userId);

        if (!static::serviceReminderWindowOpen()) {
            return 0;
        }

        $tomorrow = now()->addDay()->toDateString();
        $query = static::with('service')
            ->where('status', 'approved')
            ->whereDate('preferred_date', $tomorrow)
            ->whereHas('user', fn ($q) => $q->where('role', 'parishioner'));

        if ($userId !== null) {
            $query->where('user_id', $userId);
        }

        $created = 0;
        foreach ($query->get() as $row) {
            $alreadySent = Notification::withTrashed()
                ->where('user_id', $row->user_id)
                ->where('request_id', $row->request_id)
                ->where('type', self::SERVICE_REMINDER_TYPE)
                ->where('created_at', '>=', now()->startOfDay())
                ->exists();

            if ($alreadySent) {
                continue;
            }

            $time = self::normalizeTime($row->preferred_time);
            $when = $time !== '' ? ' at ' . date('g:i A', strtotime($time)) : '';
            $date = \Carbon\Carbon::parse($row->preferred_date)->format('M d, Y');

            Notification::create([
                'user_id' => $row->user_id,
                'request_id' => $row->request_id,
                'type' => self::SERVICE_REMINDER_TYPE,
                'title' => 'Your Service Is Tomorrow',
                'message' => 'Reminder: your booked ' . $row->notificationServiceLabel()
                    . " is tomorrow, {$date}{$when}. Please arrive a little early.",
                'status' => 'unread',
            ]);
            $created++;
        }

        return $created;
    }
}
