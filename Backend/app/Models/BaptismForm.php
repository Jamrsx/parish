<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BaptismForm extends Model
{
    protected $primaryKey = 'baptism_id';
    
    protected $fillable = [
        'child_first_name',
        'child_middle_name',
        'child_last_name',
        'child_birth_date',
        'child_birth_place',
        'mother_first_name',
        'mother_middle_name',
        'mother_last_name',
        'father_first_name',
        'father_middle_name',
        'father_last_name',
        'address',
        'contact_number',
        'preferred_date',    
        'preferred_time'     
    ];
    
    protected $casts = [
        'child_birth_date' => 'date',
        'preferred_date' => 'date',      
        'preferred_time' => 'string',    
    ];
    

    public function request()
    {
        return $this->hasOne(ManageRequest::class, 'baptism_form_id', 'baptism_id');
    }
    
    public function godparents()
    {
        return $this->hasMany(Godparent::class, 'baptism_id', 'baptism_id');
    }
    
    public function hasRequest()
    {
        return $this->request()->exists();
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
}