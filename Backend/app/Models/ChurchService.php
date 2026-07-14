<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class ChurchService extends Model
{
    protected $primaryKey = 'service_id';
    public $incrementing = true;
    protected $keyType = 'int';

    protected $fillable = [
        'service_type',
        'description',
        'icon',
        'category',
        'form_handler',
        'fee',
        'available_slots',
        'is_active',
        'is_system',
    ];

    protected $casts = [
        'fee' => 'decimal:2',
        'available_slots' => 'integer',
        'is_active' => 'boolean',
        'is_system' => 'boolean',
    ];

    // ============ AVAILABILITY METHODS ============
    
    /**
     * Get daily limit for this service
     * Uses database field with fallback to defaults
     */
    public function getDailyLimit(): int
    {
        if ($this->available_slots !== null && $this->available_slots > 0) {
            return $this->available_slots;
        }
        return $this->getDefaultLimit();
    }

    /**
     * Get default limit based on service type
     */
    private function getDefaultLimit(): int
    {
        $defaults = [
            'Baptism' => 10,
            'Funeral Mass' => 5,
            'Marriage' => 3,
            'House Blessing' => 3,
            'Special Intention' => 20,
            'Baptismal Certificate' => 999,
            'Marriage Certificate' => 999,
        ];

        return $defaults[$this->service_type] ?? 10; 
    }

    /**
     * Count requests submitted on a given calendar day for this service.
     * Daily limit applies to how many bookings parishioners can make per day,
     * not how many are scheduled on a preferred date.
     * Cancelled requests do not count toward the daily submission quota.
     */
    public function getBookingsCount($date = null, $excludeRequestId = null): int
    {
        $date = $date ?: Carbon::today();

        if ($this->service_type === 'Special Intention') {
            return SpecialIntention::query()
                ->fromParishioner()
                ->whereDate('created_at', $date)
                ->where('status', '!=', 'rejected')
                ->count();
        }

        $query = $this->requests()
            ->whereDate('created_at', $date)
            ->whereNotIn('status', ['cancelled']);

        if ($excludeRequestId) {
            $query->where('request_id', '!=', $excludeRequestId);
        }

        return $query->count();
    }

    /**
     * Check if parishioners can still submit new requests today for this service.
     */
    public function canAcceptSubmissionsToday(?int $excludeRequestId = null): bool
    {
        return $this->getBookingsCount(Carbon::today(), $excludeRequestId) < $this->getDailyLimit();
    }

    /**
     * Validate today's submission quota for this service.
     */
    public function validateTodaySubmissionQuota(?int $excludeRequestId = null): ?string
    {
        if ($this->canAcceptSubmissionsToday($excludeRequestId)) {
            return null;
        }

        $nextAvailable = $this->findNextAvailableDate(Carbon::today());

        return $nextAvailable
            ? "Today's booking limit has been reached for {$this->service_type}. Please try again on {$nextAvailable}."
            : "Today's booking limit has been reached for {$this->service_type}. Please contact the parish office.";
    }

    /**
     * Check if more requests can be submitted on a given day.
     */
    public function isDateAvailable($date, $excludeRequestId = null): bool
    {
        return $this->getBookingsCount($date, $excludeRequestId) < $this->getDailyLimit();
    }

    /**
     * Check if a specific date/time is already taken by another active request.
     */
    public function isTimeSlotTaken($date, $time, $excludeRequestId = null): bool
    {
        return ManageRequest::isTimeSlotTakenGlobally($date, $time, $excludeRequestId);
    }

    /**
     * Validate whether a preferred schedule can be used (time-slot conflicts only).
     */
    public function validateSchedule(string $date, string $time, ?int $excludeRequestId = null): ?string
    {
        if ($this->isTimeSlotTaken($date, $time, $excludeRequestId)) {
            return 'The selected time slot is already booked. Please choose another time.';
        }

        return null;
    }

    /**
     * Get remaining submission slots for a given day.
     */
    public function getRemainingSlots($date = null): int
    {
        $limit = $this->getDailyLimit();
        $bookings = $this->getBookingsCount($date);
        
        return max(0, $limit - $bookings);
    }

    /**
     * Check if parishioners can submit requests on a given day.
     */
    public function isAvailable($date = null): bool
    {
        return $this->getRemainingSlots($date) > 0;
    }

    /**
     * Check if service is fully booked for a specific date
     */
    public function isFullyBooked($date = null): bool
    {
        return $this->getRemainingSlots($date) === 0;
    }

    /**
     * Get availability status with all details
     */
    public function getAvailabilityStatus($date = null): array
    {
        $date = $date ?: Carbon::today();
        $limit = $this->getDailyLimit();
        $bookings = $this->getBookingsCount($date);
        $remaining = max(0, $limit - $bookings);
        $percentageRemaining = $limit > 0 ? ($remaining / $limit) * 100 : 0;
        $progress = $limit > 0 ? ($bookings / $limit) * 100 : 0;

        if ($remaining === 0) {
            $status = 'Fully Booked';
            $statusColor = 'red';
            $disabled = true;
            $buttonText = 'Fully Booked';
        } elseif ($percentageRemaining <= 33 && ($limit > 2 || ($limit == 2 && $remaining == 1))) {
            $status = 'Limited Slots';
            $statusColor = 'orange';
            $disabled = false;
            $buttonText = 'Start Request';
        } else {
            $status = 'Available';
            $statusColor = 'green';
            $disabled = false;
            $buttonText = 'Start Request';
        }

        return [
            'status' => $status,
            'statusColor' => $statusColor,
            'slotsRemaining' => "{$remaining}/{$limit}",
            'remainingSlots' => $remaining,
            'dailyLimit' => $limit,
            'isAvailable' => $remaining > 0,
            'isFullyBooked' => $remaining === 0,
            'disabled' => $disabled,
            'buttonText' => $buttonText,
            'progress' => $progress,
            'percentageRemaining' => $percentageRemaining,
            'bookings' => $bookings,
        ];
    }

    /**
     * Find the next day when new requests can be submitted.
     */
    public function findNextAvailableDate($startDate = null, $daysToCheck = 60): ?string
    {
        $limit = $this->getDailyLimit();
        $start = $startDate ? Carbon::parse($startDate) : Carbon::today();

        for ($i = 1; $i <= $daysToCheck; $i++) {
            $date = $start->copy()->addDays($i);
            $submissions = $this->getBookingsCount($date);

            if ($submissions < $limit) {
                return $date->format('F j, Y');
            }
        }

        return null;
    }

    /**
     * Get availability for a date range
     */
    public function getAvailabilityForDateRange($startDate, $endDate): array
    {
        $availability = [];
        $current = Carbon::parse($startDate);
        $end = Carbon::parse($endDate);
        
        while ($current <= $end) {
            $availability[] = [
                'date' => $current->format('Y-m-d'),
                'date_formatted' => $current->format('F j, Y'),
                'day' => $current->format('l'),
                'is_available' => $this->isAvailable($current),
                'remaining_slots' => $this->getRemainingSlots($current),
                'daily_limit' => $this->getDailyLimit(),
                'bookings' => $this->getBookingsCount($current),
            ];
            
            $current->addDay();
        }
        
        return $availability;
    }

    // ============ RELATIONSHIPS ============
    
    public function requests()
    {
        return $this->hasMany(ManageRequest::class, 'service_id', 'service_id');
    }

    public function pendingRequests()
    {
        return $this->requests()->where('status', 'pending');
    }

    public function approvedRequests()
    {
        return $this->requests()->where('status', 'approved');
    }

    public function ongoingRequests()
    {
        return $this->requests()->where('status', 'ongoing');
    }

    public function completedRequests()
    {
        return $this->requests()->where('status', 'done');
    }

    public function cancelledRequests()
    {
        return $this->requests()->where('status', 'cancelled');
    }

    // ============ SCOPES ============
    
    public function scopeBaptism($query)
    {
        return $query->where(function ($q) {
            $q->where('form_handler', 'baptism')
                ->orWhere('service_type', 'Baptism');
        });
    }

    public function scopeCertificates($query)
    {
        return $query->where(function ($q) {
            $q->where('category', 'certificate')
                ->orWhereIn('service_type', ['Baptismal Certificate', 'Marriage Certificate']);
        });
    }

    public function scopeUsesServiceForm($query)
    {
        return $query->where(function ($q) {
            $q->where('form_handler', 'generic')
                ->orWhereIn('form_handler', ['funeral_mass', 'marriage', 'house_blessing'])
                ->orWhereIn('service_type', ['Marriage', 'Funeral Mass', 'House Blessing']);
        })->where(function ($q) {
            $q->whereNull('category')->orWhere('category', '!=', 'certificate');
        });
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to get services that have available slots today
     */
    public function scopeAvailableToday($query)
    {
        $today = Carbon::today();
        
        return $query->where(function($q) use ($today) {
            $q->whereRaw(
                'COALESCE(available_slots, 0) > 0 AND 
                 (SELECT COUNT(*) FROM manage_requests 
                  WHERE manage_requests.service_id = church_services.service_id 
                  AND DATE(manage_requests.created_at) = ? 
                  AND manage_requests.status != ?) < COALESCE(available_slots, 0)',
                [$today->format('Y-m-d'), 'cancelled']
            );
        });
    }

    // ============ ACCESSORS ============
    
    public function getFormattedFeeAttribute()
    {
        return '₱' . number_format($this->fee, 2);
    }

    public function getFormTypeAttribute()
    {
        if ($this->isBaptism()) return 'baptism';
        if ($this->isCertificate()) return 'certificate';
        if ($this->form_handler === 'special_intention') return 'special_intention';
        if ($this->usesServiceForm()) return 'service';
        return null;
    }

    public function getRequiredFormAttribute()
    {
        if ($this->isBaptism()) return 'baptism_form';
        if ($this->isCertificate()) return 'certificate_form';
        if ($this->form_handler === 'special_intention') return 'special_intention';
        if ($this->usesServiceForm()) return 'service_form';
        return null;
    }

    public function getNavigatePathAttribute(): string
    {
        return match ($this->form_handler) {
            'baptism' => '/Parishioner/(protected)/forms_request/BaptismForm',
            'funeral_mass' => '/Parishioner/(protected)/forms_request/FuneralMassForm',
            'marriage' => '/Parishioner/(protected)/forms_request/MarriageInquiryForm',
            'house_blessing' => '/Parishioner/(protected)/forms_request/HouseBlessingsForm',
            'special_intention' => '/Parishioner/(protected)/forms_request/SpecialIntentionForm',
            'baptismal_certificate' => '/Parishioner/(protected)/certificate_request/BaptismalCertificate',
            'marriage_certificate' => '/Parishioner/(protected)/certificate_request/MarriageCertificate',
            default => '/Parishioner/(protected)/forms_request/GenericServiceForm',
        };
    }

    // ============ BOOLEAN CHECKS ============
    
    public function isBaptism()
    {
        return $this->form_handler === 'baptism' || $this->service_type === 'Baptism';
    }

    public function isMarriage()
    {
        return $this->form_handler === 'marriage' || $this->service_type === 'Marriage';
    }

    public function isFuneralMass()
    {
        return $this->form_handler === 'funeral_mass' || $this->service_type === 'Funeral Mass';
    }

    public function isHouseBlessing()
    {
        return $this->form_handler === 'house_blessing' || $this->service_type === 'House Blessing';
    }

    public function isCertificate()
    {
        return $this->category === 'certificate'
            || in_array($this->form_handler, ['baptismal_certificate', 'marriage_certificate'], true)
            || in_array($this->service_type, ['Baptismal Certificate', 'Marriage Certificate'], true);
    }

    public function usesServiceForm()
    {
        if ($this->form_handler === 'special_intention' || $this->isBaptism() || $this->isCertificate()) {
            return false;
        }

        return in_array($this->form_handler, ['generic', 'funeral_mass', 'marriage', 'house_blessing'], true)
            || in_array($this->service_type, ['Marriage', 'Funeral Mass', 'House Blessing'], true)
            || ($this->category === 'service' && $this->form_handler === 'generic');
    }

    public function getDisplayNameAttribute()
    {
        return $this->service_type;  
    }

    public function getValidStatuses(): array
    {
        return ['pending', 'approved', 'ongoing', 'done', 'cancelled'];
    }

    public function isActive(): bool
    {
        return (bool) $this->is_active;
    }

    public function getStatistics(): array
    {
        return [
            'total_requests' => $this->requests()->count(),
            'pending' => $this->pendingRequests()->count(),
            'approved' => $this->approvedRequests()->count(),
            'ongoing' => $this->ongoingRequests()->count(),
            'completed' => $this->completedRequests()->count(),
            'cancelled' => $this->cancelledRequests()->count(),
            'total_revenue' => $this->requests()
                ->where('payment_status', 'paid')
                ->sum('amount_paid'),
        ];
    }
}