<?php

namespace App\Observers;

use App\Models\ActivityLog;
use App\Models\AppSetting;
use App\Models\CertificateReprint;
use App\Models\ChurchExpense;
use App\Models\Donation;
use App\Models\IssuedCertificate;
use App\Models\ManageRequest;
use App\Models\MassCollection;
use App\Models\PaymentTransaction;
use App\Models\PriestTimeOff;
use App\Models\SpecialIntention;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Writes an activity log entry whenever a tracked church record is created, changed or deleted.
 * Logging must never break the action itself, so every failure is caught and only logged to the Laravel log.
 */
class ActivityObserver
{
    public const OBSERVED = [
        ManageRequest::class,
        PaymentTransaction::class,
        MassCollection::class,
        Donation::class,
        SpecialIntention::class,
        ChurchExpense::class,
        CertificateReprint::class,
        IssuedCertificate::class,
        PriestTimeOff::class,
        AppSetting::class,
    ];

    /** Fields that change together with a main change (status, date, payment) and add no information on their own. */
    private const NOISE_FIELDS = [
        'updated_at', 'created_at', 'processed_by', 'approved_at', 'completed_at', 'cancelled_by',
        'rescheduled_by', 'payment_status', 'amount_paid', 'payment_date', 'received_by', 'received_at',
        'reviewed_by', 'reviewed_at', 'forwarded_at', 'paid_by', 'paid_at', 'released_by', 'released_at',
        'cancelled_at', 'updated_by', 'denomination_breakdown', 'line_items',
    ];

    private static ?bool $tableReady = null;

    public function created(Model $model): void
    {
        $this->safely(fn () => $this->onCreated($model));
    }

    public function updated(Model $model): void
    {
        $this->safely(fn () => $this->onUpdated($model));
    }

    public function deleted(Model $model): void
    {
        $this->safely(fn () => $this->onDeleted($model));
    }

    private function safely(callable $fn): void
    {
        try {
            if (self::$tableReady === null) {
                self::$tableReady = Schema::hasTable('activity_logs');
            }
            if (self::$tableReady) {
                $fn();
            }
        } catch (\Throwable $e) {
            Log::warning('Activity log entry could not be written', ['error' => $e->getMessage()]);
        }
    }

    // ============ EVENTS ============

    private function onCreated(Model $model): void
    {
        match (true) {
            $model instanceof ManageRequest => $this->write('created', 'request', $model->request_id, $model->request_id,
                "New {$this->serviceName($model)} request " . ManageRequest::formatRequestReference($model->request_id)
                . " scheduled for {$this->schedule($model)}."),
            $model instanceof PaymentTransaction => $this->write('paid', 'payment', $model->payment_id, $model->request_id,
                'Payment of ' . $this->peso($model->amount) . ' received for ' . ManageRequest::formatRequestReference($model->request_id)
                . ($model->or_number ? " (OR {$model->or_number})" : '') . '.', null, $model->amount),
            $model instanceof MassCollection => $this->write('created', 'mass_collection', $model->collection_id, null,
                "Mass collection recorded: {$model->mass_type} on {$this->date($model->mass_date)}, " . $this->peso($model->amount) . '.',
                null, $model->amount),
            $model instanceof Donation => $this->write('created', 'donation', $model->donation_id, null,
                ($model->contribution_type === 'donation' ? 'Donation' : 'Love offering') . ' recorded from '
                . ($model->donor_name ?: 'Anonymous') . ', ' . $this->peso($model->amount) . '.', null, $model->amount),
            $model instanceof SpecialIntention => $this->write('created', 'special_intention', $model->intention_id, $model->request_id,
                "Special intention recorded for {$model->parishioner_name} on {$this->date($model->intention_date)}, "
                . $this->peso($model->amount) . '.', null, $model->amount),
            $model instanceof ChurchExpense => $this->write('created', 'expense', $model->expense_id, null,
                "Expense recorded: {$model->description}, " . $this->peso($model->amount) . '.', null, $model->amount),
            $model instanceof CertificateReprint => $this->write('created', 'reprint', $model->reprint_id, null,
                "Certificate reprint requested for {$model->person_name}, fee " . $this->peso($model->amount) . '.', null, $model->amount),
            $model instanceof IssuedCertificate => $this->write('created', 'certificate', $model->issued_certificate_id, $model->request_id,
                ucfirst((string) $model->certificate_type) . " certificate issued for {$model->person_name}."),
            $model instanceof PriestTimeOff => $this->write('created', 'time_off', $model->time_off_id, null,
                "Time off added for {$this->priestName($model->priest_id)}: {$model->label}"
                . ($model->reason ? " ({$model->reason})" : '') . '.'),
            $model instanceof AppSetting => $this->write('created', 'setting', $model->setting_id, null,
                "{$this->settingLabel($model->key)} set to {$this->settingValue($model->key, $model->value)}."),
            default => null,
        };
    }

    private function onUpdated(Model $model): void
    {
        $changes = $this->meaningfulChanges($model);
        if (empty($changes)) {
            return;
        }

        if ($model instanceof ManageRequest) {
            $this->requestUpdated($model, $changes);
            return;
        }

        if ($model instanceof AppSetting) {
            if (array_key_exists('value', $changes)) {
                $this->write('updated', 'setting', $model->setting_id, null,
                    "{$this->settingLabel($model->key)} changed from {$this->settingValue($model->key, $changes['value']['from'])}"
                    . " to {$this->settingValue($model->key, $changes['value']['to'])}.", $changes);
            }
            return;
        }

        [$type, $id, $requestId, $name] = $this->identify($model);

        if (array_key_exists('status', $changes)) {
            $to = $changes['status']['to'];
            $reason = $model->reject_reason ?? $model->return_reason ?? $model->cancel_reason ?? null;
            $extra = '';
            if ($model instanceof CertificateReprint && $to === 'paid' && $model->or_number) {
                $extra = " (OR {$model->or_number})";
            }
            if ($reason && in_array($to, ['rejected', 'returned', 'cancelled'], true)) {
                $extra .= ". Reason: {$reason}";
            }
            $this->write('status_changed', $type, $id, $requestId,
                "{$name} marked " . $this->statusLabel($to) . $extra . '.', $changes,
                in_array($to, ['received', 'verified', 'paid'], true) ? ($model->amount ?? null) : null);
            unset($changes['status']);
            foreach (['reject_reason', 'return_reason', 'cancel_reason', 'or_number', 'payment_notes'] as $f) {
                unset($changes[$f]);
            }
        }

        if (!empty($changes)) {
            $this->write('updated', $type, $id, $requestId,
                "{$name} edited: " . $this->describeFields($changes) . '.', $changes);
        }
    }

    private function onDeleted(Model $model): void
    {
        if ($model instanceof AppSetting) {
            $this->write('deleted', 'setting', $model->setting_id, null, "{$this->settingLabel($model->key)} reset to default.");
            return;
        }

        [$type, $id, $requestId, $name] = $this->identify($model);
        $amount = $model->amount ?? null;
        $this->write('deleted', $type, $id, $requestId,
            "{$name} deleted" . ($amount !== null ? ' (' . $this->peso($amount) . ')' : '') . '.',
            ['deleted_record' => $this->snapshot($model)], $amount);
    }

    private function requestUpdated(ManageRequest $model, array $changes): void
    {
        $ref = ManageRequest::formatRequestReference($model->request_id) . " ({$this->serviceName($model)})";

        if (array_key_exists('preferred_date', $changes) || array_key_exists('preferred_time', $changes)) {
            $from = $this->scheduleFrom($model);
            $this->write('rescheduled', 'request', $model->request_id, $model->request_id,
                "{$ref} rescheduled from {$from} to {$this->schedule($model)}"
                . ($model->reschedule_reason ? ". Reason: {$model->reschedule_reason}" : '') . '.', $changes);
            unset($changes['preferred_date'], $changes['preferred_time'], $changes['reschedule_reason']);
        }

        if (array_key_exists('assigned_priest', $changes)) {
            $to = $changes['assigned_priest']['to'];
            $from = $changes['assigned_priest']['from'];
            $text = $to
                ? ($from ? "Priest changed from {$this->priestName($from)} to {$this->priestName($to)}" : "{$this->priestName($to)} assigned")
                : 'Priest removed';
            $this->write('priest_assigned', 'request', $model->request_id, $model->request_id, "{$text} for {$ref}.", $changes);
            unset($changes['assigned_priest']);
        }

        if (array_key_exists('status', $changes)) {
            $to = $changes['status']['to'];
            $this->write('status_changed', 'request', $model->request_id, $model->request_id,
                "{$ref} marked " . $this->statusLabel($to)
                . ($to === 'cancelled' && $model->cancelled_reason ? ". Reason: {$model->cancelled_reason}" : '') . '.', $changes);
            unset($changes['status'], $changes['cancelled_reason']);
        }

        if (!empty($changes)) {
            $this->write('updated', 'request', $model->request_id, $model->request_id,
                "{$ref} edited: " . $this->describeFields($changes) . '.', $changes);
        }
    }

    // ============ HELPERS ============

    private function write(string $action, string $type, $subjectId, $requestId, string $description, ?array $changes = null, $amount = null): void
    {
        /** @var User|null $user */
        $user = Auth::user();
        $request = app()->runningInConsole() ? null : request();

        ActivityLog::create([
            'user_id' => $user?->user_id,
            'user_name' => $user ? trim($user->full_name) : null,
            'user_role' => $user?->role,
            'action' => $action,
            'subject_type' => $type,
            'subject_id' => $subjectId,
            'request_id' => $requestId,
            'description' => mb_substr($description, 0, 500),
            'changes' => $changes,
            'amount' => $amount !== null ? round((float) $amount, 2) : null,
            'ip_address' => $request?->ip(),
        ]);
    }

    /** @return array<string, array{from: mixed, to: mixed}> */
    private function meaningfulChanges(Model $model): array
    {
        $changes = [];
        foreach ($model->getChanges() as $field => $to) {
            if (in_array($field, self::NOISE_FIELDS, true)) {
                continue;
            }
            $from = $model->getOriginal($field);
            if ($from instanceof \DateTimeInterface) {
                $from = Carbon::instance($from)->format(str_contains($field, 'time') ? 'H:i' : 'Y-m-d');
            }
            if ($to instanceof \DateTimeInterface) {
                $to = Carbon::instance($to)->format(str_contains($field, 'time') ? 'H:i' : 'Y-m-d');
            }
            if ((string) $from === (string) $to) {
                continue;
            }
            $changes[$field] = ['from' => $from, 'to' => $to];
        }

        return $changes;
    }

    /** @return array{0: string, 1: mixed, 2: mixed, 3: string} */
    private function identify(Model $model): array
    {
        return match (true) {
            $model instanceof ManageRequest => ['request', $model->request_id, $model->request_id,
                ManageRequest::formatRequestReference($model->request_id) . " ({$this->serviceName($model)})"],
            $model instanceof PaymentTransaction => ['payment', $model->payment_id, $model->request_id,
                'Payment of ' . $this->peso($model->amount) . ' for ' . ManageRequest::formatRequestReference($model->request_id)],
            $model instanceof MassCollection => ['mass_collection', $model->collection_id, null,
                "Mass collection ({$model->mass_type}, {$this->date($model->mass_date)})"],
            $model instanceof Donation => ['donation', $model->donation_id, null,
                ($model->contribution_type === 'donation' ? 'Donation' : 'Love offering') . ' from ' . ($model->donor_name ?: 'Anonymous')],
            $model instanceof SpecialIntention => ['special_intention', $model->intention_id, $model->request_id,
                "Special intention for {$model->parishioner_name}"],
            $model instanceof ChurchExpense => ['expense', $model->expense_id, null, "Expense \"{$model->description}\""],
            $model instanceof CertificateReprint => ['reprint', $model->reprint_id, null, "Certificate reprint for {$model->person_name}"],
            $model instanceof IssuedCertificate => ['certificate', $model->issued_certificate_id, $model->request_id,
                "Certificate for {$model->person_name}"],
            $model instanceof PriestTimeOff => ['time_off', $model->time_off_id, null,
                "Time off of {$this->priestName($model->priest_id)} ({$model->label})"],
            default => [class_basename($model), $model->getKey(), null, class_basename($model) . ' #' . $model->getKey()],
        };
    }

    private function snapshot(Model $model): array
    {
        return collect($model->attributesToArray())
            ->except(['created_at', 'updated_at', 'denomination_breakdown', 'line_items', 'details'])
            ->all();
    }

    private function describeFields(array $changes): string
    {
        return collect($changes)->map(function ($c, $field) {
            $label = str_replace('_', ' ', $field);
            $from = $this->short($c['from']);
            $to = $this->short($c['to']);
            return "{$label} {$from} → {$to}";
        })->implode('; ');
    }

    private function short($value): string
    {
        if ($value === null || $value === '') {
            return '(empty)';
        }
        if (is_bool($value)) {
            return $value ? 'yes' : 'no';
        }
        if (is_array($value)) {
            return '(changed)';
        }
        return mb_strimwidth((string) $value, 0, 60, '…');
    }

    private function serviceName(ManageRequest $model): string
    {
        return $model->service?->service_type ?? 'service';
    }

    private function schedule(ManageRequest $model): string
    {
        $date = $model->preferred_date ? $this->date($model->preferred_date) : 'no date';
        $time = $model->preferred_time ? Carbon::parse($model->preferred_time)->format('g:i A') : '';
        return trim("{$date} {$time}");
    }

    private function scheduleFrom(ManageRequest $model): string
    {
        $date = $model->getOriginal('preferred_date');
        $time = $model->getOriginal('preferred_time');
        $dateText = $date ? $this->date($date) : 'no date';
        $timeText = $time ? Carbon::parse($time)->format('g:i A') : '';
        return trim("{$dateText} {$timeText}");
    }

    private function date($value): string
    {
        return $value ? Carbon::parse($value)->format('M j, Y') : '';
    }

    private function peso($amount): string
    {
        return '₱' . number_format((float) $amount, 2);
    }

    private function priestName($priestId): string
    {
        $priest = $priestId ? User::find($priestId) : null;
        return $priest ? 'Fr. ' . trim($priest->full_name) : 'a priest';
    }

    private function statusLabel(string $status): string
    {
        return match ($status) {
            'done' => 'completed',
            'received' => 'received by the cashier',
            'verified' => 'verified by the cashier',
            'forwarded' => 'forwarded to the cashier',
            'returned' => 'returned to the secretary',
            'awaiting_payment' => 'awaiting payment',
            default => str_replace('_', ' ', $status),
        };
    }

    private function settingLabel(string $key): string
    {
        return match ($key) {
            AppSetting::INCOME_SHARE_CHURCH_PERCENT => 'Income sharing ratio',
            AppSetting::CERTIFICATE_REPRINT_FEE => 'Certificate reprint fee',
            default => ucfirst(str_replace('_', ' ', $key)),
        };
    }

    private function settingValue(string $key, $value): string
    {
        if ($value === null) {
            return 'default';
        }
        return match ($key) {
            AppSetting::INCOME_SHARE_CHURCH_PERCENT => (int) $value . '% church / ' . (100 - (int) $value) . '% archdiocese',
            AppSetting::CERTIFICATE_REPRINT_FEE => $this->peso($value),
            default => (string) $value,
        };
    }
}
