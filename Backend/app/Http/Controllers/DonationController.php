<?php

namespace App\Http\Controllers;

use App\Models\Donation;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class DonationController extends Controller
{
    private const ALLOWED_DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5, 1];

    public function index(Request $request)
    {
        $query = Donation::with(['recordedBy', 'receivedBy']);

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('donation_date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('donation_date', '<=', $request->date_to);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('donor_name', 'LIKE', "%{$search}%")
                    ->orWhere('notes', 'LIKE', "%{$search}%");
            });
        }

        $perPage = $request->input('per_page', 20);
        $rows = $query->orderByDesc('created_at')->paginate($perPage);
        $rows->getCollection()->transform(fn ($d) => $this->transform($d));

        return response()->json([
            'success' => true,
            'data' => $rows,
        ]);
    }

    /**
     * Secretary records a donation (pending until cashier receives cash).
     */
    public function store(Request $request)
    {
        /** @var User $user */
        $user = $request->user();

        if (!$user->isSecretary()) {
            return response()->json([
                'success' => false,
                'message' => 'Only the secretary can record donations.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'donor_name' => 'nullable|string|max:150',
            'donation_date' => 'required|date',
            'notes' => 'nullable|string|max:500',
            'denomination_breakdown' => 'required|array|min:1',
            'denomination_breakdown.*.denomination' => 'required|numeric',
            'denomination_breakdown.*.count' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
                'message' => 'Add at least one denomination with a count.',
            ], 422);
        }

        $normalized = $this->normalizeBreakdown($request->input('denomination_breakdown', []));

        if ($normalized === null) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid denomination breakdown. Use valid peso denominations with count > 0.',
            ], 422);
        }

        [$breakdown, $amount] = $normalized;

        if ($amount < 0.01) {
            return response()->json([
                'success' => false,
                'message' => 'Donation total must be greater than zero.',
            ], 422);
        }

        $donation = Donation::create([
            'donor_name' => $request->donor_name ?: 'Anonymous',
            'amount' => $amount,
            'denomination_breakdown' => $breakdown,
            'donation_date' => $request->donation_date,
            'notes' => $request->notes,
            'recorded_by' => $user->user_id,
            'status' => 'pending',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Donation recorded. Remit cash to the cashier for confirmation.',
            'data' => $this->transform($donation->load(['recordedBy', 'receivedBy'])),
        ], 201);
    }

    /**
     * Cashier confirms receiving the donated cash.
     */
    public function approve(Request $request, $id)
    {
        /** @var User $user */
        $user = $request->user();

        if (!$user->isCashier()) {
            return response()->json([
                'success' => false,
                'message' => 'Only the cashier can approve donation handovers.',
            ], 403);
        }

        $donation = Donation::findOrFail($id);

        if ($donation->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Only pending donations can be approved.',
            ], 422);
        }

        $donation->update([
            'status' => 'received',
            'received_by' => $user->user_id,
            'received_at' => now(),
            'reject_reason' => null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Donation received and confirmed.',
            'data' => $this->transform($donation->fresh(['recordedBy', 'receivedBy'])),
        ]);
    }

    public function reject(Request $request, $id)
    {
        /** @var User $user */
        $user = $request->user();

        if (!$user->isCashier()) {
            return response()->json([
                'success' => false,
                'message' => 'Only the cashier can reject donation handovers.',
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

        $donation = Donation::findOrFail($id);

        if ($donation->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Only pending donations can be rejected.',
            ], 422);
        }

        $donation->update([
            'status' => 'rejected',
            'received_by' => $user->user_id,
            'received_at' => now(),
            'reject_reason' => $request->reject_reason,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Donation handover rejected due to discrepancy.',
            'data' => $this->transform($donation->fresh(['recordedBy', 'receivedBy'])),
        ]);
    }

    /**
     * @return array{0: array<int, array{denomination: float, count: int, total: float}>, 1: float}|null
     */
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

    private function transform(Donation $d): array
    {
        return [
            'donation_id' => $d->donation_id,
            'donor_name' => $d->donor_name ?: 'Anonymous',
            'amount' => (float) $d->amount,
            'denomination_breakdown' => $d->denomination_breakdown ?: [],
            'donation_date' => $d->donation_date?->format('Y-m-d'),
            'notes' => $d->notes,
            'status' => $d->status,
            'recorded_by' => $d->recordedBy?->full_name,
            'received_by' => $d->receivedBy?->full_name,
            'received_at' => $d->received_at?->toIso8601String(),
            'reject_reason' => $d->reject_reason,
            'created_at' => $d->created_at?->toIso8601String(),
        ];
    }
}
