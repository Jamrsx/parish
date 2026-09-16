<?php

namespace App\Http\Controllers;

use App\Models\ChurchService;
use App\Models\ManageRequest;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class PriestDashboardController extends Controller
{
    /**
     * Monthly activity for the logged-in priest (assigned services only).
     */
    public function monthlyActivity(Request $request)
    {
        /** @var User|null $user */
        $user = $request->user();
        if (!$user || !$user->isPriest()) {
            return response()->json([
                'success' => false,
                'message' => 'Only priests can view monthly activity.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'year' => 'nullable|integer|min:2020|max:2100',
            'month' => 'nullable|integer|min:1|max:12',
            'service_id' => 'nullable|integer|exists:church_services,service_id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $now = Carbon::now();
        $year = (int) ($request->input('year') ?: $now->year);
        $month = (int) ($request->input('month') ?: $now->month);
        $serviceId = $request->filled('service_id') ? (int) $request->input('service_id') : null;

        $start = Carbon::create($year, $month, 1)->startOfDay();
        $end = $start->copy()->endOfMonth();

        $requests = ManageRequest::with(['service', 'user'])
            ->where('assigned_priest', $user->user_id)
            ->whereBetween('preferred_date', [$start->toDateString(), $end->toDateString()])
            ->when($serviceId, fn ($q) => $q->where('service_id', $serviceId))
            ->orderBy('preferred_date')
            ->orderBy('preferred_time')
            ->get();

        $summary = [
            'total_assigned' => $requests->count(),
            'pending' => $requests->where('status', 'pending')->count(),
            'approved' => $requests->where('status', 'approved')->count(),
            'completed' => $requests->where('status', 'done')->count(),
            'cancelled' => $requests->where('status', 'cancelled')->count(),
        ];

        $byService = [];
        foreach ($requests as $row) {
            $label = $row->service?->service_type ?: 'Other';
            $id = $row->service_id;
            $key = $id ?: 'other';
            if (!isset($byService[$key])) {
                $byService[$key] = [
                    'service_id' => $id,
                    'service_type' => $label,
                    'request_count' => 0,
                    'completed_count' => 0,
                    'approved_count' => 0,
                    'cancelled_count' => 0,
                ];
            }
            $byService[$key]['request_count']++;
            if ($row->status === 'done') {
                $byService[$key]['completed_count']++;
            }
            if ($row->status === 'approved') {
                $byService[$key]['approved_count']++;
            }
            if ($row->status === 'cancelled') {
                $byService[$key]['cancelled_count']++;
            }
        }

        $activityByService = collect($byService)
            ->map(function ($row) use ($requests) {
                $count = (int) $row['request_count'];
                $all = $requests->count();
                return [
                    'service_id' => $row['service_id'],
                    'service_type' => $row['service_type'],
                    'request_count' => $count,
                    'completed_count' => (int) $row['completed_count'],
                    'approved_count' => (int) $row['approved_count'],
                    'cancelled_count' => (int) $row['cancelled_count'],
                    'percentage' => $all > 0 ? round(($count / $all) * 100, 1) : 0.0,
                ];
            })
            ->sortByDesc('request_count')
            ->values()
            ->all();

        $activeServices = ChurchService::query()
            ->where('is_active', true)
            ->orderBy('service_type')
            ->get(['service_id', 'service_type']);

        $assignedServiceIds = ManageRequest::query()
            ->where('assigned_priest', $user->user_id)
            ->whereNotNull('service_id')
            ->distinct()
            ->pluck('service_id');

        $historicalServices = ChurchService::query()
            ->whereIn('service_id', $assignedServiceIds)
            ->orderBy('service_type')
            ->get(['service_id', 'service_type']);

        $servicesForFilter = $activeServices
            ->concat($historicalServices)
            ->unique('service_id')
            ->sortBy('service_type')
            ->values()
            ->map(fn ($s) => [
                'service_id' => $s->service_id,
                'service_type' => $s->service_type,
            ])
            ->all();

        $assignments = $requests->map(function (ManageRequest $row) {
            return [
                'request_id' => $row->request_id,
                'service_id' => $row->service_id,
                'service_type' => $row->service?->service_type ?: 'Other',
                'preferred_date' => $row->preferred_date
                    ? Carbon::parse($row->preferred_date)->format('Y-m-d')
                    : null,
                'preferred_time' => ManageRequest::normalizeTime($row->preferred_time),
                'status' => $row->status,
                'parishioner' => $row->user?->full_name,
            ];
        })->values()->all();

        $payload = [
            'year' => $year,
            'month' => $month,
            'month_label' => $start->format('F Y'),
            'service_id' => $serviceId,
            'period' => [
                'start' => $start->toDateString(),
                'end' => $end->toDateString(),
            ],
            'summary' => $summary,
            'activity_by_service' => $activityByService,
            'available_services' => $servicesForFilter,
            'assignments' => $assignments,
        ];

        Log::info('Priest monthly activity loaded', [
            'priest_id' => $user->user_id,
            'year' => $year,
            'month' => $month,
            'service_id' => $serviceId,
            'total' => $summary['total_assigned'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $payload,
        ]);
    }
}
