<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Godparent extends Model
{
    protected $table = 'godparents';
    protected $primaryKey = 'godparent_id';
    
    
    public $timestamps = true;
    
    protected $fillable = [
        'baptism_id',
        'godparent_name',
        'relationship',
    ];
    
    protected $casts = [
        'godparent_id' => 'integer',
        'baptism_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
    

    public function baptismForm()
    {
        return $this->belongsTo(BaptismForm::class, 'baptism_id', 'baptism_id');
    }
    
    public function scopeGodfathers($query)
    {
        return $query->where('relationship', 'godfather');
    }
    
    public function scopeGodmothers($query)
    {
        return $query->where('relationship', 'godmother');
    }
    
    public function isGodfather(): bool
    {
        return $this->relationship === 'godfather';
    }
    
    public function isGodmother(): bool
    {
        return $this->relationship === 'godmother';
    }
}