<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CertificateForm extends Model
{
    protected $primaryKey = 'certificate_id';
    
    protected $fillable = [
        'service_id',      
        'full_name',
        'birth_date',
        'marriage_date',
        'address',
        'contact_number',
        'preferred_date',    
        'preferred_time'     
    ];
    
    protected $casts = [
        'birth_date' => 'date',
        'marriage_date' => 'date',
        'preferred_date' => 'date',      
        'preferred_time' => 'string',    
    ];
    
    // ============ RELATIONSHIPS ============
    
    /**
     * Get the church service associated with this certificate
     */
    public function churchService()
    {
        return $this->belongsTo(ChurchService::class, 'service_id', 'service_id');
    }
    
    /**
     * Get the request associated with this certificate form
     */
    public function request()
    {
        return $this->hasOne(ManageRequest::class, 'certificate_form_id', 'certificate_id');
    }
    
    // ============ CHECK METHODS ============
    
    public function hasRequest()
    {
        return $this->request()->exists();
    }
    
    // ============ CERTIFICATE TYPE METHODS ============
    
    /**
     * Get certificate type from the associated church service
     */
    public function getCertificateTypeAttribute()
    {
        return $this->churchService?->service_type;
    }
    
    /**
     * Check if this is a baptismal certificate
     */
    public function isBaptismal()
    {
        return $this->certificate_type === 'Baptismal Certificate';
    }
    
    /**
     * Check if this is a marriage certificate
     */
    public function isMarriage()
    {
        return $this->certificate_type === 'Marriage Certificate';
    }
    
    /**
     * Get certificate type label for display
     */
    public function getCertificateTypeLabelAttribute()
    {
        $type = $this->certificate_type;
        if ($type === 'Baptismal Certificate') return 'Baptismal';
        if ($type === 'Marriage Certificate') return 'Marriage';
        return $type;
    }
    
    // ============ SERVICE INFORMATION ============
    
    public function getServiceNameAttribute()
    {
        return $this->churchService?->service_type;
    }
    
    public function getServiceFeeAttribute()
    {
        return $this->churchService?->fee;
    }
    
    public function getFormattedFeeAttribute()
    {
        return $this->churchService?->formatted_fee;
    }
    
    // ============ FORMATTED DATE/TIME ============
    
    public function getFormattedPreferredTimeAttribute()
    {
        if ($this->preferred_time) {
            return date('h:i A', strtotime($this->preferred_time));
        }
        return null;
    }
    
    public function getFormattedPreferredDateAttribute()
    {
        if ($this->preferred_date) {
            return date('F d, Y', strtotime($this->preferred_date));
        }
        return null;
    }
    
    public function getFormattedBirthDateAttribute()
    {
        if ($this->birth_date) {
            return date('F d, Y', strtotime($this->birth_date));
        }
        return null;
    }
    
    public function getFormattedMarriageDateAttribute()
    {
        if ($this->marriage_date) {
            return date('F d, Y', strtotime($this->marriage_date));
        }
        return null;
    }
    
    // ============ SCOPES ============
    
    public function scopeBaptismal($query)
    {
        return $query->whereHas('churchService', function($q) {
            $q->where('service_type', 'Baptismal Certificate');
        });
    }
    
    public function scopeMarriage($query)
    {
        return $query->whereHas('churchService', function($q) {
            $q->where('service_type', 'Marriage Certificate');
        });
    }
    
    public function scopeSearch($query, $search)
    {
        return $query->where(function($q) use ($search) {
            $q->where('full_name', 'LIKE', "%{$search}%")
              ->orWhere('contact_number', 'LIKE', "%{$search}%")
              ->orWhere('address', 'LIKE', "%{$search}%");
        });
    }
}