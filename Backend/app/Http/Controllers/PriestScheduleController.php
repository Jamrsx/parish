<?php

namespace App\Http\Controllers;

use App\Models\BaptismForm;
use App\Models\ManageRequest;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class PriestScheduleController extends Controller
{
    private const SCHEDULE_STATUSES = ['pending', 'approved', 'done'];
    private const MAX_RANGE_DAYS = 92;

    /**
     * Upcoming-assignment counts and next assignment for every priest (for the Manage Priests list).
     */
    public function summary()
    {
        $today = Carbon::today();
        $nowTime = Carbon::now()->format('H:i');
        $weekEnd = $today->copy()->endOfWeek(Carbon::SATURDAY);
        $monthEnd = $today->copy()->endOfMonth();

        $priests = User::where('role', 'priest')->get();

        $upcoming = ManageRequest::query()
            ->whereIn('assigned_priest', $priests->pluck('user_id'))
            ->whereIn('status', ['pending', 'approved'])
            ->whereDate('preferred_date', '>=', $today->toDateString())
            ->with('service:service_id,service_type')
            ->orderBy('preferred_date')
            ->orderBy('preferred_time')
            ->get()
            ->filter(function (ManageRequest $request) use ($today, $nowTime) {
                $date = Carbon::parse($request->preferred_date);
                if (!$date->isSameDay($today)) {
                    return true;
                }
                $time = ManageRequest::normalizeTime($request->preferred_time);
                return $time === '' || $time > $nowTime;
            })
            ->groupBy('assigned_priest');

        $data = $priests->map(function (User $priest) use ($upcoming, $weekEnd, $monthEnd) {
            $items = $upcoming->get($priest->user_id, collect());
            $next = $items->first();

            return [
                'priest_id' => $priest->user_id,
                'is_active' => $priest->isActive(),
                'is_available' => $priest->is_available !== false,
                'upcoming_count' => $items->count(),
                'this_week_count' => $items->filter(fn ($r) => Carbon::parse($r->preferred_date)->lte($weekEnd))->count(),
                'this_month_count' => $items->filter(fn ($r) => Carbon::parse($r->preferred_date)->lte($monthEnd))->count(),
                'next_assignment' => $next ? $this->formatAssignment($next, false) : null,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * One priest's assignments plus other parish bookings in a date range.
     */
    public function show(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'from' => 'required|date_format:Y-m-d',
            'to' => 'required|date_format:Y-m-d|after_or_equal:from',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $from = Carbon::parse($request->input('from'))->startOfDay();
        $to = Carbon::parse($request->input('to'))->startOfDay();

        if ($from->diffInDays($to) > self::MAX_RANGE_DAYS) {
            return response()->json([
                'success' => false,
                'message' => 'Please request at most 3 months at a time.',
            ], 422);
        }

        $priest = User::find($id);
        if (!$priest || !$priest->isPriest()) {
            return response()->json([
                'success' => false,
                'message' => 'Priest not found.',
            ], 404);
        }

        try {
            $assignments = ManageRequest::query()
                ->where('assigned_priest', $priest->user_id)
                ->whereIn('status', self::SCHEDULE_STATUSES)
                ->whereDate('preferred_date', '>=', $from->toDateString())
                ->whereDate('preferred_date', '<=', $to->toDateString())
                ->with(['service:service_id,service_type', 'user', 'baptismForm', 'serviceForm', 'certificateForm'])
                ->orderBy('preferred_date')
                ->orderBy('preferred_time')
                ->get()
                ->map(fn (ManageRequest $r) => $this->formatAssignment($r, true))
                ->values();

            $otherBookings = ManageRequest::query()
                ->whereDate('preferred_date', '>=', $from->toDateString())
                ->whereDate('preferred_date', '<=', $to->toDateString())
                ->blockingSchedule()
                ->where(function ($q) use ($priest) {
                    $q->whereNull('assigned_priest')->orWhere('assigned_priest', '!=', $priest->user_id);
                })
                ->with(['service:service_id,service_type', 'assignedPriest:user_id,first_name,middle_name,last_name'])
                ->get()
                ->map(fn (ManageRequest $r) => [
                    'request_id' => $r->request_id,
                    'date' => Carbon::parse($r->preferred_date)->format('Y-m-d'),
                    'time' => ManageRequest::normalizeTime($r->preferred_time),
                    'service_type' => $r->service?->service_type ?? 'Service',
                    'status' => $r->status,
                    'assigned_priest_name' => $r->assignedPriest?->full_name,
                ])
                ->values();

            $today = Carbon::today();
            $nowTime = Carbon::now()->format('H:i');
            $upcoming = ManageRequest::query()
                ->where('assigned_priest', $priest->user_id)
                ->whereIn('status', ['pending', 'approved'])
                ->whereDate('preferred_date', '>=', $today->toDateString())
                ->with('service:service_id,service_type')
                ->orderBy('preferred_date')
                ->orderBy('preferred_time')
                ->get()
                ->filter(function (ManageRequest $r) use ($today, $nowTime) {
                    if (!Carbon::parse($r->preferred_date)->isSameDay($today)) {
                        return true;
                    }
                    $time = ManageRequest::normalizeTime($r->preferred_time);
                    return $time === '' || $time > $nowTime;
                })
                ->values();

            $weekEnd = $today->copy()->endOfWeek(Carbon::SATURDAY);
            $monthEnd = $today->copy()->endOfMonth();
            $next = $upcoming->first();

            return response()->json([
                'success' => true,
                'data' => [
                    'priest' => [
                        'user_id' => $priest->user_id,
                        'full_name' => trim($priest->full_name),
                        'email' => $priest->email,
                        'contact_number' => $priest->contact_number,
                        'is_active' => $priest->isActive(),
                        'is_available' => $priest->is_available !== false,
                    ],
                    'from' => $from->toDateString(),
                    'to' => $to->toDateString(),
                    'time_slots' => ManageRequest::SERVICE_TIME_SLOTS,
                    'assignments' => $assignments,
                    'other_bookings' => $otherBookings,
                    'summary' => [
                        'upcoming_count' => $upcoming->count(),
                        'this_week_count' => $upcoming->filter(fn ($r) => Carbon::parse($r->preferred_date)->lte($weekEnd))->count(),
                        'this_month_count' => $upcoming->filter(fn ($r) => Carbon::parse($r->preferred_date)->lte($monthEnd))->count(),
                        'next_assignment' => $next ? $this->formatAssignment($next, false) : null,
                    ],
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to load priest schedule', ['priest_id' => $id, 'error' => $e->getMessage()]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to load the priest schedule. Please try again.',
            ], 500);
        }
    }

    private function formatAssignment(ManageRequest $request, bool $withClient): array
    {
        $data = [
            'request_id' => $request->request_id,
            'date' => Carbon::parse($request->preferred_date)->format('Y-m-d'),
            'time' => ManageRequest::normalizeTime($request->preferred_time),
            'service_type' => $request->service?->service_type ?? 'Service',
            'status' => $request->status,
        ];

        if ($withClient) {
            $data['client_name'] = $this->clientName($request);
            $data['requested_by'] = $request->user ? trim($request->user->full_name) : null;
        }

        return $data;
    }

    private function clientName(ManageRequest $request): ?string
    {
        $form = $request->baptismForm ?? $request->serviceForm ?? $request->certificateForm;

        if ($form instanceof BaptismForm) {
            $middle = $form->child_middle_name ? ' ' . $form->child_middle_name : '';
            return trim("{$form->child_first_name}{$middle} {$form->child_last_name}");
        }

        if ($form && !empty($form->full_name)) {
            return trim($form->full_name);
        }

        return $request->user ? trim($request->user->full_name) : null;
    }
}
