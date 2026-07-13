<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Notification extends Model
{
    use HasFactory, SoftDeletes;

    protected $primaryKey = 'notification_id';
    protected $table = 'notifications';

    protected $fillable = [
        'user_id',
        'request_id',
        'type',
        'title',
        'message',
        'status'
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    //Now uses User model instead of Parishioner
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    public function request()
    {
        return $this->belongsTo(ManageRequest::class, 'request_id', 'request_id');
    }

    // Scopes
    public function scopeUnread($query)
    {
        return $query->where('status', 'unread');
    }

    public function scopeRead($query)
    {
        return $query->where('status', 'read');
    }

    // Mark as read
    public function markAsRead()
    {
        $this->update(['status' => 'read']);
    }

    // Mark as unread
    public function markAsUnread()
    {
        $this->update(['status' => 'unread']);
    }
}