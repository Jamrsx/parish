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
        'fee',
        'available_slots',
    ];

    protected $casts = [
        'fee' => 'decimal:2',
        'available_slots' => 'integer',
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
            'Baptismal Certificate' => 999,
            'Marriage Certificate' => 999,
        ];

        return $defaults[$this->service_type] ?? 10; 
    }

    /**
     * Get active bookings count for a specific preferred date.
     * Cancelled and completed requests do not block scheduling.
     */
    public function getBookingsCount($date = null, $excludeRequestId = null): int
    {
        $date = $date ?: Carbon::today();

        $query = $this->requests()
            ->whereDate('preferred_date', $date)
            ->whereIn('status', ['pending', 'approved']);

        if ($excludeRequestId) {
            $query->where('request_id', '!=', $excludeRequestId);
        }

        return $query->count();
    }

    /**
     * Check if a date still has available slots.
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
     * Validate whether a schedule can be used for this service.
     */
    public function validateSchedule(string $date, string $time, ?int $excludeRequestId = null): ?string
    {
        if (!$this->isDateAvailable($date, $excludeRequestId)) {
            return 'No available slots for the selected date. Please choose another date.';
        }

        if ($this->isTimeSlotTaken($date, $time, $excludeRequestId)) {
            return 'The selected time slot is already booked. Please choose another time.';
        }

        return null;
    }

    /**
     * Get remaining slots for a specific date
     */
    public function getRemainingSlots($date = null): int
    {
        $limit = $this->getDailyLimit();
        $bookings = $this->getBookingsCount($date);
        
        return max(0, $limit - $bookings);
    }

    /**
     * Check if service is available for a specific date
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
            $buttonText = 'Inquire Now';
        } else {
            $status = 'Available';
            $statusColor = 'green';
            $disabled = false;
            $buttonText = 'Inquire Now';
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
     * Find next available date with optional start date
     */
    public function findNextAvailableDate($startDate = null, $daysToCheck = 60): ?string
    {
        $limit = $this->getDailyLimit();
        $start = $startDate ? Carbon::parse($startDate) : Carbon::today();
        
        for ($i = 1; $i <= $daysToCheck; $i++) {
            $date = $start->copy()->addDays($i);
            $bookings = $this->getBookingsCount($date);
            
            if ($bookings < $limit) {
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
        return $query->where('service_type', 'Baptism');  
    }

    public function scopeCertificates($query)
    {
        return $query->whereIn('service_type', ['Baptismal Certificate', 'Marriage Certificate']); 
    }

    public function scopeUsesServiceForm($query)
    {
        return $query->whereIn('service_type', ['Marriage', 'Funeral Mass', 'House Blessing']); 
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
                  AND DATE(manage_requests.preferred_date) = ? 
                  AND manage_requests.status IN (?, ?)) < COALESCE(available_slots, 0)',
                [$today->format('Y-m-d'), 'pending', 'approved']
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
        if ($this->usesServiceForm()) return 'service';
        return null;
    }

    public function getRequiredFormAttribute()
    {
        $forms = [
            'Baptism' => 'baptism_form',
            'Marriage' => 'service_form',
            'Funeral Mass' => 'service_form',
            'House Blessing' => 'service_form',
            'Baptismal Certificate' => 'certificate_form',
            'Marriage Certificate' => 'certificate_form'
        ];

        return $forms[$this->service_type] ?? null; 
    }

    // ============ BOOLEAN CHECKS ============
    
    public function isBaptism()
    {
        return $this->service_type === 'Baptism'; 
    }

    public function isMarriage()
    {
        return $this->service_type === 'Marriage';  
    }

    public function isFuneralMass()
    {
        return $this->service_type === 'Funeral Mass';  
    }

    public function isHouseBlessing()
    {
        return $this->service_type === 'House Blessing';  
    }

    public function isCertificate()
    {
        return in_array($this->service_type, ['Baptismal Certificate', 'Marriage Certificate']); 
    }

    public function usesServiceForm()
    {
        return in_array($this->service_type, ['Marriage', 'Funeral Mass', 'House Blessing']);  
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
        return $this->available_slots > 0 || $this->getDefaultLimit() > 0;
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