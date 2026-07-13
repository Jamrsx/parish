<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ServiceForm extends Model
{
    use HasFactory;

    protected $primaryKey = 'serviceform_id';
    
    protected $fillable = [
        'service_id',      
        'full_name',
        'address',
        'contact_number',
        'preferred_date',    
        'preferred_time'     
    ];
    
    protected $casts = [
        'preferred_date' => 'date',      
        'preferred_time' => 'string',    
    ];
    
    // ============ RELATIONSHIPS ============
    
    public function request()
    {
        return $this->hasOne(ManageRequest::class, 'service_form_id', 'serviceform_id');
    }
    
    public function churchService()
    {
        return $this->belongsTo(ChurchService::class, 'service_id', 'service_id');
    }
    
    // ============ ACCESSORS ============
    
    public function getServiceTypeAttribute()
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
    
    // ============ CHECK METHODS ============
    
    public function hasRequest()
    {
        return $this->request()->exists();
    }
    
    // ============ SCOPES ============
    
    public function scopeSearch($query, $search)
    {
        return $query->where(function($q) use ($search) {
            $q->where('full_name', 'LIKE', "%{$search}%")
              ->orWhere('contact_number', 'LIKE', "%{$search}%")
              ->orWhere('address', 'LIKE', "%{$search}%")
              ->orWhereHas('churchService', function($subQ) use ($search) {
                  $subQ->where('service_type', 'LIKE', "%{$search}%");
              });
        });
    }
    
    public function scopeByServiceId($query, $serviceId)
    {
        return $query->where('service_id', $serviceId);
    }
    
    public function scopeByServiceType($query, $serviceType)
    {
        return $query->whereHas('churchService', function($q) use ($serviceType) {
            $q->where('service_type', $serviceType);
        });
    }
}