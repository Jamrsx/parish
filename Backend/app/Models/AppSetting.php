<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppSetting extends Model
{
    public const CERTIFICATE_REPRINT_FEE = 'certificate_reprint_fee';
    public const DEFAULT_CERTIFICATE_REPRINT_FEE = 100.00;

    protected $primaryKey = 'setting_id';

    protected $fillable = [
        'key',
        'value',
        'updated_by',
    ];

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by', 'user_id');
    }

    public static function getValue(string $key, $default = null)
    {
        $row = static::where('key', $key)->first();

        return $row ? $row->value : $default;
    }

    public static function setValue(string $key, $value, ?int $userId = null): self
    {
        return static::updateOrCreate(
            ['key' => $key],
            ['value' => (string) $value, 'updated_by' => $userId]
        );
    }

    public static function certificateReprintFee(): float
    {
        return round((float) static::getValue(self::CERTIFICATE_REPRINT_FEE, self::DEFAULT_CERTIFICATE_REPRINT_FEE), 2);
    }
}
