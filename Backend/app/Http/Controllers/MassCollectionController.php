<?php

namespace App\Http\Controllers;

use App\Models\MassCollection;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class MassCollectionController extends Controller
{
    private const ALLOWED_DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5, 1];

    public function index(Request $request)
    {
        $query = MassCollection::with(['recordedBy', 'receivedBy']);

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('mass_date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('mass_date', '<=', $request->date_to);
        }

        $perPage = $request->input('per_page', 20);
        $rows = $query->orderByDesc('mass_date')->orderByDesc('created_at')->paginate($perPage);
        $rows->getCollection()->transform(fn ($m) => $this->transform($m));

        return response()->json([
            'success' => true,
            'data' => $rows,
        ]);
    }

    /**
     * Secretary records mass cash (pending until cashier confirms).
     */
    public function store(Request $request)
    {
        /** @var User $user */
        $user = $request->user();

        if (!$user->isSecretary()) {
            return response()->json([
                'success' => false,
                'message' => 'Only the secretary can record mass collections.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'mass_date' => 'required|date',
            'mass_type' => 'required|string|max:100',
            'mass_time' => 'nullable|date_format:H:i',
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
                'message' => 'Invalid denomination breakdown.',
            ], 422);
        }

        [$breakdown, $amount] = $normalized;

        if ($amount < 0.01) {
            return response()->json([
                'success' => false,
                'message' => 'Collection total must be greater than zero.',
            ], 422);
        }

        $collection = MassCollection::create([
            'mass_date' => $request->mass_date,
            'mass_type' => $request->mass_type,
            'mass_time' => $request->mass_time,
            'amount' => $amount,
            'denomination_breakdown' => $breakdown,
            'recorded_by' => $user->user_id,
            'notes' => $request->notes,
            'status' => 'pending',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Mass collection recorded. Remit cash to the cashier for confirmation.',
            'data' => $this->transform($collection->load(['recordedBy', 'receivedBy'])),
        ], 201);
    }

    public function approve(Request $request, $id)
    {
        /** @var User $user */
        $user = $request->user();

        if (!$user->isCashier()) {
            return response()->json([
                'success' => false,
                'message' => 'Only the cashier can approve mass collections.',
            ], 403);
        }

        $collection = MassCollection::findOrFail($id);

        if ($collection->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Only pending mass collections can be approved.',
            ], 422);
        }

        $collection->update([
            'status' => 'received',
            'received_by' => $user->user_id,
            'received_at' => now(),
            'reject_reason' => null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Mass collection confirmed.',
            'data' => $this->transform($collection->fresh(['recordedBy', 'receivedBy'])),
        ]);
    }

    public function reject(Request $request, $id)
    {
        /** @var User $user */
        $user = $request->user();

        if (!$user->isCashier()) {
            return response()->json([
                'success' => false,
                'message' => 'Only the cashier can reject mass collections.',
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

        $collection = MassCollection::findOrFail($id);

        if ($collection->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Only pending mass collections can be rejected.',
            ], 422);
        }

        $collection->update([
            'status' => 'rejected',
            'received_by' => $user->user_id,
            'received_at' => now(),
            'reject_reason' => $request->reject_reason,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Mass collection declined due to discrepancy.',
            'data' => $this->transform($collection->fresh(['recordedBy', 'receivedBy'])),
        ]);
    }

    /**
     * Secretary may delete only pending entries.
     */
    public function destroy(Request $request, $id)
    {
        /** @var User $user */
        $user = $request->user();

        if (!$user->isSecretary()) {
            return response()->json([
                'success' => false,
                'message' => 'Only the secretary can delete pending mass collections.',
            ], 403);
        }

        $collection = MassCollection::findOrFail($id);

        if ($collection->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Only pending mass collections can be deleted.',
            ], 422);
        }

        $collection->delete();

        return response()->json([
            'success' => true,
            'message' => 'Mass collection deleted.',
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

    private function transform(MassCollection $m): array
    {
        $time = $m->mass_time;
        if ($time) {
            try {
                $time = Carbon::parse($time)->format('H:i');
            } catch (\Exception $e) {
                $time = substr((string) $time, 0, 5);
            }
        }

        return [
            'collection_id' => $m->collection_id,
            'mass_date' => $m->mass_date?->format('Y-m-d'),
            'mass_type' => $m->mass_type,
            'mass_time' => $time,
            'amount' => (float) $m->amount,
            'denomination_breakdown' => $m->denomination_breakdown ?: [],
            'notes' => $m->notes,
            'status' => $m->status,
            'recorded_by' => $m->recordedBy?->full_name,
            'received_by' => $m->receivedBy?->full_name,
            'received_at' => $m->received_at?->toIso8601String(),
            'reject_reason' => $m->reject_reason,
            'created_at' => $m->created_at?->toIso8601String(),
        ];
    }
}
