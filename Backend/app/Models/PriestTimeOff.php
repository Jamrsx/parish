<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PriestTimeOff extends Model
{
    protected $table = 'priest_time_off';
    protected $primaryKey = 'time_off_id';

    protected $fillable = [
        'priest_id',
        'start_date',
        'end_date',
        'start_time',
        'end_time',
        'reason',
        'created_by',
    ];

    protected $casts = [
        'start_date' => 'date:Y-m-d',
        'end_date' => 'date:Y-m-d',
    ];

    public function priest(): BelongsTo
    {
        return $this->belongsTo(User::class, 'priest_id', 'user_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by', 'user_id');
    }

    public function isWholeDay(): bool
    {
        return empty($this->start_time) || empty($this->end_time);
    }

    /** Entries that touch any day between $from and $to (inclusive). */
    public function scopeOverlapping($query, string $from, string $to)
    {
        return $query->whereDate('start_date', '<=', $to)->whereDate('end_date', '>=', $from);
    }

    /**
     * Whether this entry blocks a service on $date at $time (H:i).
     * Without a time, only whole-day entries count.
     */
    public function covers(string $date, ?string $time = null): bool
    {
        $day = Carbon::parse($date)->toDateString();
        if ($day < $this->start_date->toDateString() || $day > $this->end_date->toDateString()) {
            return false;
        }

        if ($this->isWholeDay()) {
            return true;
        }

        $time = ManageRequest::normalizeTime($time);
        if ($time === '') {
            return false;
        }

        return $time >= $this->start_time && $time < $this->end_time;
    }

    /** e.g. "Oct 10 – Oct 12, whole day" or "Oct 10, 13:00 – 15:00" */
    public function getLabelAttribute(): string
    {
        $start = $this->start_date->format('M j');
        $end = $this->end_date->format('M j');
        $dates = $start === $end ? $start : "{$start} – {$end}";
        $hours = $this->isWholeDay() ? 'whole day' : $this->formatTime($this->start_time) . ' – ' . $this->formatTime($this->end_time);

        return "{$dates}, {$hours}";
    }

    private function formatTime(string $time): string
    {
        return Carbon::createFromFormat('H:i', $time)->format('g:i A');
    }

    public function toApiArray(): array
    {
        return [
            'time_off_id' => $this->time_off_id,
            'priest_id' => $this->priest_id,
            'priest_name' => $this->relationLoaded('priest') && $this->priest ? trim($this->priest->full_name) : null,
            'start_date' => $this->start_date->toDateString(),
            'end_date' => $this->end_date->toDateString(),
            'start_time' => $this->isWholeDay() ? null : $this->start_time,
            'end_time' => $this->isWholeDay() ? null : $this->end_time,
            'whole_day' => $this->isWholeDay(),
            'reason' => $this->reason,
            'label' => $this->label,
            'created_by' => $this->created_by,
            'created_by_name' => $this->relationLoaded('createdBy') && $this->createdBy ? trim($this->createdBy->full_name) : null,
            'added_by_priest' => (int) $this->created_by === (int) $this->priest_id,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
