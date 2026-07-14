<?php

namespace App\Http\Controllers;

use App\Models\SpecialIntention;
use App\Models\ServiceForm;
use App\Models\ChurchService;
use App\Models\ManageRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class SpecialIntentionController extends Controller
{
    private const ALLOWED_DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5, 1];

    public function index(Request $request)
    {
        // Heal stuck special intentions: request already approved/done but SI still pending.
        SpecialIntention::query()
            ->where('status', 'pending')
            ->whereHas('manageRequest', function ($q) {
                $q->whereIn('status', ['approved', 'done']);
            })
            ->update([
                'status' => 'approved',
                'reject_reason' => null,
            ]);

        $query = SpecialIntention::with(['recordedBy', 'receivedBy']);

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('intention_date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('intention_date', '<=', $request->date_to);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('parishioner_name', 'LIKE', "%{$search}%")
                    ->orWhere('intention_text', 'LIKE', "%{$search}%")
                    ->orWhere('notes', 'LIKE', "%{$search}%");
            });
        }

        $perPage = $request->input('per_page', 20);
        $rows = $query->orderByDesc('created_at')->paginate($perPage);
        $rows->getCollection()->transform(fn ($row) => $this->transform($row));

        return response()->json([
            'success' => true,
            'data' => $rows,
        ]);
    }

    public function store(Request $request)
    {
        /** @var User $user */
        $user = $request->user();

        if (!$user->isSecretary()) {
            return response()->json([
                'success' => false,
                'message' => 'Only the secretary can record special intentions.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'parishioner_name' => 'required|string|max:150',
            'intention_text' => 'required|string|min:5|max:1000',
            'intention_date' => 'required|date',
            'notes' => 'nullable|string|max:500',
            'denomination_breakdown' => 'required|array|min:1',
            'denomination_breakdown.*.denomination' => 'required|numeric',
            'denomination_breakdown.*.count' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
                'message' => 'Name, intention, and at least one denomination are required.',
            ], 422);
        }

        $normalized = $this->normalizeBreakdown($request->input('denomination_breakdown', []));
        if ($normalized === null) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid denomination breakdown.',
            ], 422);
        }

        [$breakdown, $amount] = $normalized;
        if ($amount < 0.01) {
            return response()->json([
                'success' => false,
                'message' => 'Offering total must be greater than zero.',
            ], 422);
        }

        // Walk-in already reviewed by secretary → visible to cashier immediately
        $row = SpecialIntention::create([
            'parishioner_name' => $request->parishioner_name,
            'intention_text' => $request->intention_text,
            'amount' => $amount,
            'denomination_breakdown' => $breakdown,
            'intention_date' => $request->intention_date,
            'notes' => $request->notes,
            'source' => SpecialIntention::SOURCE_SECRETARY,
            'recorded_by' => $user->user_id,
            'status' => 'approved',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Special intention recorded. Remit cash to the cashier for confirmation.',
            'data' => $this->transform($row->load(['recordedBy', 'receivedBy', 'user'])),
        ], 201);
    }

    /**
     * Parishioner requests a special intention (creates My Requests entry).
     * Waits for secretary approval before appearing to cashier.
     */
    public function storeParishioner(Request $request)
    {
        /** @var User $user */
        $user = $request->user();

        if (!$user->isParishioner()) {
            return response()->json([
                'success' => false,
                'message' => 'Only parishioners can submit special intention requests.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'parishioner_name' => 'required|string|max:150',
            'intention_text' => 'required|string|min:5|max:1000',
            'intention_date' => 'required|date|after_or_equal:today',
            'preferred_time' => 'required|date_format:H:i',
            'notes' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
                'message' => 'Name, intention, date, and preferred time are required.',
            ], 422);
        }

        $churchService = ChurchService::where('service_type', 'Special Intention')->first();
        if (!$churchService) {
            return response()->json([
                'success' => false,
                'message' => 'Special Intention service is not configured.',
            ], 422);
        }

        $quotaError = $churchService->validateTodaySubmissionQuota();
        if ($quotaError) {
            return response()->json([
                'success' => false,
                'message' => $quotaError,
                'data' => [
                    'next_available_date' => $churchService->findNextAvailableDate(),
                    'remaining_slots' => $churchService->getRemainingSlots(),
                    'daily_limit' => $churchService->getDailyLimit(),
                ],
            ], 422);
        }

        $minOffering = (float) ($churchService->fee ?? SpecialIntention::MIN_OFFERING);
        $intentionDate = $request->intention_date;
        $preferredTime = $request->preferred_time . ':00';

        try {
            $row = DB::transaction(function () use ($request, $user, $churchService, $minOffering, $intentionDate, $preferredTime) {
                $serviceForm = ServiceForm::create([
                    'service_id' => $churchService->service_id,
                    'full_name' => $request->parishioner_name,
                    'address' => $request->intention_text,
                    'contact_number' => $user->contact_number ?: 'N/A',
                    'preferred_date' => $intentionDate,
                    'preferred_time' => $preferredTime,
                ]);

                // Always unpaid until cashier records the offering (even when fee is ₱0 / any amount).
                $manageRequest = ManageRequest::create([
                    'user_id' => $user->user_id,
                    'service_id' => $churchService->service_id,
                    'service_form_id' => $serviceForm->serviceform_id,
                    'preferred_date' => $intentionDate,
                    'preferred_time' => $preferredTime,
                    'status' => 'pending',
                    'payment_status' => 'unpaid',
                    'amount_paid' => 0,
                ]);

                try {
                    $manageRequest->createNewRequestNotification();
                } catch (\Exception $e) {
                    // continue
                }

                return SpecialIntention::create([
                    'user_id' => $user->user_id,
                    'request_id' => $manageRequest->request_id,
                    'parishioner_name' => $request->parishioner_name,
                    'intention_text' => $request->intention_text,
                    'amount' => $minOffering,
                    'denomination_breakdown' => null,
                    'intention_date' => $intentionDate,
                    'notes' => $request->notes,
                    'source' => SpecialIntention::SOURCE_PARISHIONER,
                    'recorded_by' => $user->user_id,
                    'status' => 'pending',
                ]);
            });
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to submit special intention: ' . $e->getMessage(),
            ], 500);
        }

        $payMessage = $minOffering > 0
            ? 'Await secretary approval, then pay ₱' . number_format($minOffering, 2) . ' at the parish cashier.'
            : 'Await secretary approval, then visit the parish cashier. Any offering amount is accepted, including none.';

        return response()->json([
            'success' => true,
            'message' => 'Special intention submitted. ' . $payMessage,
            'data' => $this->transform($row->load(['recordedBy', 'receivedBy', 'user'])),
        ], 201);
    }

    public function parishionerIndex(Request $request)
    {
        /** @var User $user */
        $user = $request->user();

        $rows = SpecialIntention::with(['recordedBy', 'receivedBy'])
            ->where('user_id', $user->user_id)
            ->orderByDesc('created_at')
            ->paginate($request->input('per_page', 20));

        $rows->getCollection()->transform(fn ($row) => $this->transform($row));

        return response()->json([
            'success' => true,
            'data' => $rows,
        ]);
    }

    /**
     * Secretary approves a parishioner app request → visible to cashier.
     */
    public function secretaryApprove(Request $request, $id)
    {
        /** @var User $user */
        $user = $request->user();

        if (!$user->isSecretary()) {
            return response()->json([
                'success' => false,
                'message' => 'Only the secretary can approve special intention requests.',
            ], 403);
        }

        $row = SpecialIntention::findOrFail($id);

        if ($row->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Only pending special intentions can be approved by the secretary.',
            ], 422);
        }

        DB::transaction(function () use ($row, $user) {
            $row->update([
                'status' => 'approved',
                'reject_reason' => null,
            ]);

            if ($row->request_id) {
                $manageRequest = ManageRequest::find($row->request_id);
                if ($manageRequest && $manageRequest->status === 'pending') {
                    $manageRequest->update([
                        'status' => 'approved',
                        'approved_at' => now(),
                        'processed_by' => $user->user_id,
                    ]);
                }
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Special intention approved. It is now visible to the cashier.',
            'data' => $this->transform($row->fresh(['recordedBy', 'receivedBy'])),
        ]);
    }

    /**
     * Secretary rejects a parishioner app request.
     */
    public function secretaryReject(Request $request, $id)
    {
        /** @var User $user */
        $user = $request->user();

        if (!$user->isSecretary()) {
            return response()->json([
                'success' => false,
                'message' => 'Only the secretary can reject special intention requests.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'reject_reason' => 'required|string|min:5|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $row = SpecialIntention::findOrFail($id);

        if ($row->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Only pending special intentions can be rejected by the secretary.',
            ], 422);
        }

        DB::transaction(function () use ($row, $user, $request) {
            $row->update([
                'status' => 'rejected',
                'reject_reason' => $request->reject_reason,
            ]);

            if ($row->request_id) {
                $manageRequest = ManageRequest::find($row->request_id);
                if ($manageRequest && $manageRequest->status !== 'cancelled') {
                    $manageRequest->update([
                        'status' => 'cancelled',
                        'cancelled_by' => $user->user_id,
                        'cancelled_reason' => 'Special intention rejected by secretary: ' . $request->reject_reason,
                    ]);
                }
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Special intention request rejected.',
            'data' => $this->transform($row->fresh(['recordedBy', 'receivedBy'])),
        ]);
    }

    /**
     * Cashier confirms cash offering (only after secretary approval).
     * Amount received may be any value >= 0 when the service fee is ₱0 (any amount).
     */
    public function approve(Request $request, $id)
    {
        /** @var User $user */
        $user = $request->user();

        if (!$user->isCashier()) {
            return response()->json([
                'success' => false,
                'message' => 'Only the cashier can confirm special intention handovers.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'amount' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
                'message' => 'Enter a valid offering amount (0 or more).',
            ], 422);
        }

        $row = SpecialIntention::findOrFail($id);

        if ($row->status !== 'approved') {
            return response()->json([
                'success' => false,
                'message' => 'Only secretary-approved special intentions can be confirmed by the cashier.',
            ], 422);
        }

        $configuredFee = (float) (
            ChurchService::where('service_type', 'Special Intention')->value('fee')
            ?? SpecialIntention::MIN_OFFERING
        );

        // Cashier-entered amount wins; otherwise keep expected/row amount (secretary records).
        // For any-amount (fee 0) with no input, treat as ₱0 paid.
        if ($request->filled('amount') || $request->has('amount')) {
            $amountReceived = round((float) $request->input('amount', 0), 2);
        } else {
            $amountReceived = $configuredFee > 0
                ? (float) $row->amount
                : 0.0;
        }

        if ($amountReceived < 0) {
            return response()->json([
                'success' => false,
                'message' => 'Amount received cannot be negative.',
            ], 422);
        }

        DB::transaction(function () use ($row, $user, $amountReceived) {
            $row->update([
                'status' => 'received',
                'amount' => $amountReceived,
                'received_by' => $user->user_id,
                'received_at' => now(),
                'reject_reason' => null,
            ]);

            if ($row->request_id) {
                $manageRequest = ManageRequest::with('service')->find($row->request_id);
                if ($manageRequest) {
                    $manageRequest->update([
                        'status' => 'done',
                        'payment_status' => 'paid',
                        'amount_paid' => $amountReceived,
                        'payment_date' => now(),
                        'completed_at' => now(),
                        'processed_by' => $user->user_id,
                        'approved_at' => $manageRequest->approved_at ?: now(),
                    ]);
                }
            }
        });

        Log::info('Cashier confirmed special intention offering', [
            'intention_id' => $row->intention_id,
            'amount_received' => $amountReceived,
            'cashier_id' => $user->user_id,
        ]);

        return response()->json([
            'success' => true,
            'message' => $amountReceived > 0
                ? 'Special intention offering of ₱' . number_format($amountReceived, 2) . ' confirmed.'
                : 'Special intention confirmed with no cash offering.',
            'data' => $this->transform($row->fresh(['recordedBy', 'receivedBy'])),
        ]);
    }

    /**
     * Cashier declines due to cash discrepancy (only after secretary approval).
     */
    public function reject(Request $request, $id)
    {
        /** @var User $user */
        $user = $request->user();

        if (!$user->isCashier()) {
            return response()->json([
                'success' => false,
                'message' => 'Only the cashier can reject special intention handovers.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'reject_reason' => 'required|string|min:5|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $row = SpecialIntention::findOrFail($id);

        if ($row->status !== 'approved') {
            return response()->json([
                'success' => false,
                'message' => 'Only secretary-approved special intentions can be declined by the cashier.',
            ], 422);
        }

        DB::transaction(function () use ($row, $user, $request) {
            $row->update([
                'status' => 'rejected',
                'received_by' => $user->user_id,
                'received_at' => now(),
                'reject_reason' => $request->reject_reason,
            ]);

            if ($row->request_id) {
                $manageRequest = ManageRequest::find($row->request_id);
                if ($manageRequest && $manageRequest->status !== 'cancelled') {
                    $manageRequest->update([
                        'status' => 'cancelled',
                        'cancelled_by' => $user->user_id,
                        'cancelled_reason' => 'Special intention declined: ' . $request->reject_reason,
                    ]);
                }
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Special intention declined due to discrepancy.',
            'data' => $this->transform($row->fresh(['recordedBy', 'receivedBy'])),
        ]);
    }

    public function destroy(Request $request, $id)
    {
        /** @var User $user */
        $user = $request->user();

        if (!$user->isSecretary()) {
            return response()->json([
                'success' => false,
                'message' => 'Only the secretary can delete pending special intentions.',
            ], 403);
        }

        $row = SpecialIntention::findOrFail($id);

        if (!in_array($row->status, ['pending', 'approved'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Only pending or approved special intentions can be deleted.',
            ], 422);
        }

        DB::transaction(function () use ($row, $user) {
            if ($row->request_id) {
                $manageRequest = ManageRequest::find($row->request_id);
                if ($manageRequest && $manageRequest->status !== 'cancelled') {
                    $manageRequest->update([
                        'status' => 'cancelled',
                        'cancelled_by' => $user->user_id,
                        'cancelled_reason' => 'Special intention deleted by secretary.',
                    ]);
                }
            }
            $row->delete();
        });

        return response()->json([
            'success' => true,
            'message' => 'Special intention deleted.',
        ]);
    }

    private function normalizeBreakdown(array $rows): ?array
    {
        $normalized = [];
        $amount = 0.0;

        foreach ($rows as $row) {
            $denom = (float) ($row['denomination'] ?? 0);
            $count = (int) ($row['count'] ?? 0);

            if ($count < 1) {
                continue;
            }

            if (!in_array((int) $denom, self::ALLOWED_DENOMS, true)) {
                return null;
            }

            $total = $denom * $count;
            $normalized[] = [
                'denomination' => $denom,
                'count' => $count,
                'total' => $total,
            ];
            $amount += $total;
        }

        if (count($normalized) === 0) {
            return null;
        }

        return [$normalized, round($amount, 2)];
    }

    private function transform(SpecialIntention $row): array
    {
        $configuredFee = ChurchService::where('service_type', 'Special Intention')->value('fee');
        $minOffering = (float) ($configuredFee ?? SpecialIntention::MIN_OFFERING);
        $anyAmount = $configuredFee !== null && (float) $configuredFee === 0.0;

        return [
            'intention_id' => $row->intention_id,
            'request_id' => $row->request_id,
            'user_id' => $row->user_id,
            'parishioner_name' => $row->parishioner_name,
            'intention_text' => $row->intention_text,
            'amount' => (float) $row->amount,
            'denomination_breakdown' => $row->denomination_breakdown ?: [],
            'intention_date' => $row->intention_date?->format('Y-m-d'),
            'notes' => $row->notes,
            'source' => $row->source ?: SpecialIntention::SOURCE_SECRETARY,
            'status' => $row->status,
            'recorded_by' => $row->recordedBy?->full_name,
            'received_by' => $row->receivedBy?->full_name,
            'received_at' => $row->received_at?->toIso8601String(),
            'reject_reason' => $row->reject_reason,
            'created_at' => $row->created_at?->toIso8601String(),
            'min_offering' => $minOffering,
            'any_amount' => $anyAmount,
        ];
    }
}
