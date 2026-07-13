<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Support\Facades\Hash;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $primaryKey = 'user_id';
    protected $table = 'users';

    protected $fillable = [
        'first_name',
        'middle_name',
        'last_name',
        'contact_number',
        'address',
        'email',
        'username',
        'password',
        'role',
        'last_login',
        'is_active',
        'is_available',
    ];

    protected $hidden = [
        'password',
    ];

    protected $casts = [
        'last_login' => 'datetime',
        'is_active' => 'boolean',
        'is_available' => 'boolean',
    ];

    /**
     * Hash the password when setting it
     */
    public function setPasswordAttribute($value)
    {
        $this->attributes['password'] = Hash::make($value);
    }

    /**
     * Get the user's full name
     */
    public function getFullNameAttribute(): string
    {
        $middle = $this->middle_name ? ' ' . $this->middle_name . ' ' : ' ';
        return $this->first_name . $middle . $this->last_name;
    }

    /**
     * Get the user's full name with title/prefix
     */
    public function getFullNameWithTitleAttribute(): string
    {
        $prefix = match($this->role) {
            'priest' => 'Fr. ',
            default => '',
        };
        return $prefix . $this->full_name;
    }

    /**
     * Role check methods
     */
    public function isSecretary(): bool
    {
        return $this->role === 'secretary';
    }

    public function isCashier(): bool
    {
        return $this->role === 'cashier';
    }

    public function isPriest(): bool
    {
        return $this->role === 'priest';
    }

    public function isParishioner(): bool
    {
        return $this->role === 'parishioner';
    }

    public function isAdmin(): bool
    {
        return in_array($this->role, ['secretary', 'cashier']);
    }

    public function isActive(): bool
    {
        return $this->is_active !== false;
    }

    public function isAvailableForAssignment(): bool
    {
        return $this->isActive() && $this->is_available !== false;
    }

    /**
     * Get role label for display
     */
    public function getRoleLabelAttribute(): string
    {
        return match($this->role) {
            'secretary' => 'Secretary',
            'cashier' => 'Cashier',
            'priest' => 'Priest',
            'parishioner' => 'Parishioner',
            default => 'User',
        };
    }

    /**
     * Relationships
     */
    public function requests()
    {
        return $this->hasMany(ManageRequest::class, 'user_id', 'user_id');
    }

    public function processedRequests()
    {
        return $this->hasMany(ManageRequest::class, 'processed_by', 'user_id');
    }

    public function cancelledRequests()
    {
        return $this->hasMany(ManageRequest::class, 'cancelled_by', 'user_id');
    }

    public function assignedRequests()
    {
        return $this->hasMany(ManageRequest::class, 'assigned_priest', 'user_id');
    }

    public function notifications()
    {
        return $this->hasMany(Notification::class, 'user_id', 'user_id');
    }

    public function unreadNotifications()
    {
        return $this->notifications()->where('status', 'unread');
    }

    /**
     * Scope for filtering by role
     */
    public function scopeSecretaries($query)
    {
        return $query->where('role', 'secretary');
    }

    public function scopeCashiers($query)
    {
        return $query->where('role', 'cashier');
    }

    public function scopePriests($query)
    {
        return $query->where('role', 'priest');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeAvailable($query)
    {
        return $query->where('is_available', true);
    }

    public function scopeParishioners($query)
    {
        return $query->where('role', 'parishioner');
    }

    public function scopeAdmins($query)
    {
        return $query->whereIn('role', ['secretary', 'cashier']);
    }

    /**
     * Search scope
     */
    public function scopeSearch($query, $search)
    {
        return $query->where(function($q) use ($search) {
            $q->where('first_name', 'LIKE', "%{$search}%")
              ->orWhere('last_name', 'LIKE', "%{$search}%")
              ->orWhere('email', 'LIKE', "%{$search}%")
              ->orWhere('username', 'LIKE', "%{$search}%")
              ->orWhere('contact_number', 'LIKE', "%{$search}%");
        });
    }

    /**
     * Check if user has specific permission (role-based)
     */
    public function hasPermission(string $permission): bool
    {
        $permissions = [
            'secretary' => [
                'manage_requests', 'process_requests', 'view_all_requests',
                'manage_services', 'manage_inventory', 'view_reports'
            ],
            'cashier' => [
                'manage_payments', 'view_payments', 'process_payments',
                'view_reports'
            ],
            'priest' => [
                'view_assigned_requests', 'update_request_status'
            ],
            'parishioner' => [
                'create_requests', 'view_own_requests'
            ],
        ];

        return in_array($permission, $permissions[$this->role] ?? []);
    }
}