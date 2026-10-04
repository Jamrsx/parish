<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppSetting extends Model
{
    public const CERTIFICATE_REPRINT_FEE = 'certificate_reprint_fee';
    public const DEFAULT_CERTIFICATE_REPRINT_FEE = 100.00;

    /** Percentage of all income kept by the parish church; the rest goes to the archdiocese. */
    public const INCOME_SHARE_CHURCH_PERCENT = 'income_share_church_percent';
    public const DEFAULT_INCOME_SHARE_CHURCH_PERCENT = 60;

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

    public static function churchSharePercent(): int
    {
        $value = (int) static::getValue(self::INCOME_SHARE_CHURCH_PERCENT, self::DEFAULT_INCOME_SHARE_CHURCH_PERCENT);

        return ($value >= 1 && $value <= 99) ? $value : self::DEFAULT_INCOME_SHARE_CHURCH_PERCENT;
    }

    /**
     * Splits an income amount between the church and the archdiocese.
     * The archdiocese share is total minus church share so both always add up exactly.
     *
     * @return array{church_percent: int, archdiocese_percent: int, total: float, church_amount: float, archdiocese_amount: float}
     */
    public static function splitIncome(float $total, ?int $churchPercent = null): array
    {
        $churchPercent ??= static::churchSharePercent();
        $total = round($total, 2);
        $church = round($total * $churchPercent / 100, 2);

        return [
            'church_percent' => $churchPercent,
            'archdiocese_percent' => 100 - $churchPercent,
            'total' => $total,
            'church_amount' => $church,
            'archdiocese_amount' => round($total - $church, 2),
        ];
    }
}
