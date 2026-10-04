<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use App\Models\CertificateReprint;
use App\Models\IssuedCertificate;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

/**
 * Paid certificate reprints: secretary requests → cashier marks paid → secretary prints and releases.
 */
class CertificateReprintController extends Controller
{
    private const MIN_FEE = 1;
    private const MAX_FEE = 10000;

    // ============ FEE SETTING (secretary) ============

    public function getFee()
    {
        $row = AppSetting::with('updatedBy:user_id,first_name,middle_name,last_name')
            ->where('key', AppSetting::CERTIFICATE_REPRINT_FEE)
            ->first();

        return response()->json([
            'success' => true,
            'data' => $this->feePayload($row),
        ]);
    }

    public function updateFee(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:' . self::MIN_FEE . '|max:' . self::MAX_FEE,
        ], [
            'amount.required' => 'Enter the reprint fee.',
            'amount.min' => 'The reprint fee must be at least ₱' . self::MIN_FEE . '.',
            'amount.max' => 'The reprint fee cannot be more than ₱' . number_format(self::MAX_FEE) . '.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        /** @var User $user */
        $user = $request->user();
        $amount = round((float) $request->amount, 2);
        $previous = AppSetting::certificateReprintFee();

        AppSetting::setValue(AppSetting::CERTIFICATE_REPRINT_FEE, number_format($amount, 2, '.', ''), $user->user_id);

        Log::info('Certificate reprint fee updated', [
            'from' => $previous,
            'to' => $amount,
            'by' => $user->user_id,
        ]);

        $row = AppSetting::with('updatedBy:user_id,first_name,middle_name,last_name')
            ->where('key', AppSetting::CERTIFICATE_REPRINT_FEE)
            ->first();

        return response()->json([
            'success' => true,
            'message' => 'Reprint fee saved and locked at ₱' . number_format($amount, 2) . '. New reprints will use this amount.',
            'data' => $this->feePayload($row),
        ]);
    }

    // ============ REPRINTS (secretary) ============

    public function index(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'nullable|in:all,' . implode(',', CertificateReprint::STATUSES),
            'search' => 'nullable|string|max:150',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        $page = $this->listQuery($request)
            ->orderByRaw("FIELD(status, 'paid', 'awaiting_payment', 'released', 'cancelled')")
            ->orderByDesc('created_at')
            ->paginate((int) ($request->query('per_page') ?: 10))
            ->through(fn (CertificateReprint $r) => $this->payload($r));

        return response()->json([
            'success' => true,
            'data' => $page,
            'counts' => $this->statusCounts(),
        ]);
    }

    public function store(Request $request, $issuedId)
    {
        $validator = Validator::make($request->all(), [
            'reason' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        $issued = IssuedCertificate::find($issuedId);
        if (!$issued) {
            return response()->json([
                'success' => false,
                'message' => 'Certificate not found.',
            ], 404);
        }

        $open = CertificateReprint::where('issued_certificate_id', $issued->issued_certificate_id)
            ->whereIn('status', [CertificateReprint::STATUS_AWAITING_PAYMENT, CertificateReprint::STATUS_PAID])
            ->first();

        if ($open) {
            $message = $open->status === CertificateReprint::STATUS_PAID
                ? 'This certificate already has a paid reprint waiting to be released. Print it from Reprint requests.'
                : 'This certificate already has a reprint waiting for payment at the treasurer.';

            return response()->json([
                'success' => false,
                'message' => $message,
                'data' => $this->payload($open->load(['requestedBy', 'paidBy', 'releasedBy', 'cancelledBy', 'issuedCertificate'])),
            ], 422);
        }

        /** @var User $user */
        $user = $request->user();
        $fee = AppSetting::certificateReprintFee();

        $reprint = CertificateReprint::create([
            'issued_certificate_id' => $issued->issued_certificate_id,
            'person_name' => $issued->person_name,
            'certificate_type' => $issued->certificate_type,
            'amount' => $fee,
            'reason' => filled($request->reason) ? trim($request->reason) : null,
            'status' => CertificateReprint::STATUS_AWAITING_PAYMENT,
            'requested_by' => $user->user_id,
        ]);

        Log::info('Certificate reprint requested', [
            'reprint_id' => $reprint->reprint_id,
            'issued_certificate_id' => $issued->issued_certificate_id,
            'amount' => $fee,
            'by' => $user->user_id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Reprint sent to the treasurer for payment of ₱' . number_format($fee, 2) . '. You can print it once it is marked paid.',
            'data' => $this->payload($reprint->fresh(['requestedBy', 'issuedCertificate'])),
        ], 201);
    }

    public function release(Request $request, $id)
    {
        /** @var User $user */
        $user = $request->user();

        $result = DB::transaction(function () use ($id, $user) {
            $reprint = CertificateReprint::lockForUpdate()->find($id);

            if (!$reprint) {
                return [404, 'Reprint not found.', null];
            }
            if ($reprint->status !== CertificateReprint::STATUS_PAID) {
                return [422, $this->blockedMessage($reprint, 'released'), $reprint];
            }

            $reprint->update([
                'status' => CertificateReprint::STATUS_RELEASED,
                'released_by' => $user->user_id,
                'released_at' => now(),
            ]);

            return [200, 'Certificate released.', $reprint];
        });

        [$code, $message, $reprint] = $result;
        Log::info('Certificate reprint release', ['reprint_id' => $id, 'code' => $code, 'by' => $user->user_id]);

        return response()->json([
            'success' => $code === 200,
            'message' => $message,
            'data' => $reprint ? $this->payload($reprint->fresh(['requestedBy', 'paidBy', 'releasedBy', 'cancelledBy', 'issuedCertificate'])) : null,
        ], $code);
    }

    public function cancel(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'reason' => 'required|string|min:3|max:255',
        ], [
            'reason.required' => 'Please give a reason for cancelling.',
            'reason.min' => 'Please give a reason for cancelling.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        /** @var User $user */
        $user = $request->user();

        [$code, $message, $reprint] = DB::transaction(function () use ($id, $user, $request) {
            $reprint = CertificateReprint::lockForUpdate()->find($id);

            if (!$reprint) {
                return [404, 'Reprint not found.', null];
            }
            if ($reprint->status !== CertificateReprint::STATUS_AWAITING_PAYMENT) {
                return [422, $this->blockedMessage($reprint, 'cancelled'), $reprint];
            }

            $reprint->update([
                'status' => CertificateReprint::STATUS_CANCELLED,
                'cancelled_by' => $user->user_id,
                'cancelled_at' => now(),
                'cancel_reason' => trim($request->reason),
            ]);

            return [200, 'Reprint request cancelled.', $reprint];
        });

        Log::info('Certificate reprint cancel', ['reprint_id' => $id, 'code' => $code, 'by' => $user->user_id]);

        return response()->json([
            'success' => $code === 200,
            'message' => $message,
            'data' => $reprint ? $this->payload($reprint->fresh(['requestedBy', 'paidBy', 'releasedBy', 'cancelledBy', 'issuedCertificate'])) : null,
        ], $code);
    }

    // ============ CASHIER ============

    public function cashierIndex(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'view' => 'nullable|in:awaiting,history',
            'search' => 'nullable|string|max:150',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        $view = $request->query('view', 'awaiting');
        $query = $this->listQuery($request, false);

        if ($view === 'history') {
            $query->whereIn('status', [CertificateReprint::STATUS_PAID, CertificateReprint::STATUS_RELEASED])
                ->orderByDesc('paid_at');
        } else {
            $query->where('status', CertificateReprint::STATUS_AWAITING_PAYMENT)
                ->orderBy('created_at');
        }

        $page = $query->paginate((int) ($request->query('per_page') ?: 20))
            ->through(fn (CertificateReprint $r) => $this->payload($r, false));

        return response()->json([
            'success' => true,
            'data' => $page,
            'awaiting_count' => CertificateReprint::where('status', CertificateReprint::STATUS_AWAITING_PAYMENT)->count(),
        ]);
    }

    public function markPaid(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'or_number' => 'nullable|string|max:50',
            'notes' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        /** @var User $user */
        $user = $request->user();

        [$code, $message, $reprint] = DB::transaction(function () use ($id, $user, $request) {
            $reprint = CertificateReprint::lockForUpdate()->find($id);

            if (!$reprint) {
                return [404, 'Reprint not found.', null];
            }
            if ($reprint->status !== CertificateReprint::STATUS_AWAITING_PAYMENT) {
                return [422, $this->blockedMessage($reprint, 'paid'), $reprint];
            }

            $reprint->update([
                'status' => CertificateReprint::STATUS_PAID,
                'paid_by' => $user->user_id,
                'paid_at' => now(),
                'or_number' => filled($request->or_number) ? trim($request->or_number) : null,
                'payment_notes' => filled($request->notes) ? trim($request->notes) : null,
            ]);

            return [200, 'Payment of ₱' . number_format((float) $reprint->amount, 2) . ' recorded. The secretary can now release the certificate.', $reprint];
        });

        Log::info('Certificate reprint mark paid', ['reprint_id' => $id, 'code' => $code, 'by' => $user->user_id]);

        return response()->json([
            'success' => $code === 200,
            'message' => $message,
            'data' => $reprint ? $this->payload($reprint->fresh(['requestedBy', 'paidBy', 'releasedBy', 'cancelledBy']), false) : null,
        ], $code);
    }

    // ============ HELPERS ============

    private function listQuery(Request $request, bool $applyStatus = true)
    {
        $query = CertificateReprint::query()->with([
            'requestedBy:user_id,first_name,middle_name,last_name',
            'paidBy:user_id,first_name,middle_name,last_name',
            'releasedBy:user_id,first_name,middle_name,last_name',
            'cancelledBy:user_id,first_name,middle_name,last_name',
            'issuedCertificate',
        ]);

        $status = $request->query('status');
        if ($applyStatus && $status && $status !== 'all') {
            $query->where('status', $status);
        }

        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $like = "%{$search}%";
            $query->where(function ($q) use ($like, $search) {
                $q->where('person_name', 'LIKE', $like)
                    ->orWhere('or_number', 'LIKE', $like);
                if (ctype_digit($search)) {
                    $q->orWhere('reprint_id', (int) $search);
                }
            });
        }

        return $query;
    }

    private function statusCounts(): array
    {
        $counts = CertificateReprint::query()
            ->select('status', DB::raw('COUNT(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status');

        return collect(CertificateReprint::STATUSES)
            ->mapWithKeys(fn ($s) => [$s => (int) ($counts[$s] ?? 0)])
            ->all();
    }

    private function blockedMessage(CertificateReprint $reprint, string $action): string
    {
        return match ($reprint->status) {
            CertificateReprint::STATUS_AWAITING_PAYMENT => 'This reprint has not been paid yet. The treasurer must mark it paid first.',
            CertificateReprint::STATUS_PAID => $action === 'paid'
                ? 'This reprint is already marked as paid.'
                : 'This reprint is already paid, so it can no longer be cancelled.',
            CertificateReprint::STATUS_RELEASED => 'This reprint was already released.',
            CertificateReprint::STATUS_CANCELLED => 'This reprint was cancelled.',
            default => 'This action is not allowed right now.',
        };
    }

    private function feePayload(?AppSetting $row): array
    {
        return [
            'amount' => $row ? round((float) $row->value, 2) : AppSetting::DEFAULT_CERTIFICATE_REPRINT_FEE,
            'is_default' => $row === null,
            'updated_at' => $row?->updated_at?->toIso8601String(),
            'updated_by' => $row?->updatedBy ? trim($row->updatedBy->full_name) : null,
        ];
    }

    private function payload(CertificateReprint $r, bool $withDetails = true): array
    {
        $issued = $r->issuedCertificate;

        $data = [
            'reprint_id' => $r->reprint_id,
            'issued_certificate_id' => $r->issued_certificate_id,
            'person_name' => $r->person_name,
            'certificate_type' => $r->certificate_type,
            'amount' => (float) $r->amount,
            'reason' => $r->reason,
            'status' => $r->status,
            'requested_by' => $r->requestedBy ? trim($r->requestedBy->full_name) : null,
            'requested_at' => $r->created_at?->toIso8601String(),
            'paid_by' => $r->paidBy ? trim($r->paidBy->full_name) : null,
            'paid_at' => $r->paid_at?->toIso8601String(),
            'or_number' => $r->or_number,
            'payment_notes' => $r->payment_notes,
            'released_by' => $r->releasedBy ? trim($r->releasedBy->full_name) : null,
            'released_at' => $r->released_at?->toIso8601String(),
            'cancelled_by' => $r->cancelledBy ? trim($r->cancelledBy->full_name) : null,
            'cancelled_at' => $r->cancelled_at?->toIso8601String(),
            'cancel_reason' => $r->cancel_reason,
            'purpose' => $issued?->purpose,
        ];

        if ($withDetails) {
            $data['details'] = $issued?->details;
        }

        return $data;
    }
}
