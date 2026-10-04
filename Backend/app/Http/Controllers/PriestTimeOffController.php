<?php

namespace App\Http\Controllers;

use App\Models\ManageRequest;
use App\Models\Notification;
use App\Models\PriestTimeOff;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class PriestTimeOffController extends Controller
{
    private const MAX_SPAN_DAYS = 92;
    private const MAX_LIST_DAYS = 100;
    private const END_TIMES = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

    // ============ PRIEST: own time off ============

    public function myStore(Request $request): JsonResponse
    {
        $priest = $request->user();

        return $this->saveEntry($request, $priest, null, $priest);
    }

    public function myUpdate(Request $request, $id): JsonResponse
    {
        $priest = $request->user();
        $entry = PriestTimeOff::where('priest_id', $priest->user_id)->find($id);

        if (!$entry) {
            return response()->json(['success' => false, 'message' => 'Time off entry not found.'], 404);
        }

        return $this->saveEntry($request, $priest, $entry, $priest);
    }

    public function myDestroy(Request $request, $id): JsonResponse
    {
        $priest = $request->user();
        $entry = PriestTimeOff::where('priest_id', $priest->user_id)->find($id);

        if (!$entry) {
            return response()->json(['success' => false, 'message' => 'Time off entry not found.'], 404);
        }

        return $this->deleteEntry($entry, $priest);
    }

    // ============ SECRETARY: any priest ============

    /** All priests' time off in a range (Scheduled Services calendar). */
    public function index(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'from' => 'required|date_format:Y-m-d',
            'to' => 'required|date_format:Y-m-d|after_or_equal:from',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => $validator->errors()->first()], 422);
        }

        $from = $request->input('from');
        $to = $request->input('to');

        if (Carbon::parse($from)->diffInDays(Carbon::parse($to)) > self::MAX_LIST_DAYS) {
            return response()->json(['success' => false, 'message' => 'Please request at most 3 months at a time.'], 422);
        }

        User::releaseExpiredUnavailability();

        $entries = PriestTimeOff::query()
            ->overlapping($from, $to)
            ->whereHas('priest', fn ($q) => $q->where('role', 'priest'))
            ->with(['priest:user_id,first_name,middle_name,last_name', 'createdBy:user_id,first_name,middle_name,last_name'])
            ->orderBy('start_date')
            ->get()
            ->map(fn (PriestTimeOff $e) => $e->toApiArray())
            ->values();

        // Priests who switched themselves off show as away from today until their chosen date
        $switchedOff = User::where('role', 'priest')
            ->where('is_active', true)
            ->where('is_available', false)
            ->get()
            ->map(fn (User $p) => [
                'priest_id' => $p->user_id,
                'priest_name' => trim($p->full_name),
                'unavailable_until' => $p->unavailable_until?->toDateString(),
            ])
            ->values();

        return response()->json([
            'success' => true,
            'data' => [
                'from' => $from,
                'to' => $to,
                'time_off' => $entries,
                'switched_off' => $switchedOff,
            ],
        ]);
    }

    public function store(Request $request, $priestId): JsonResponse
    {
        $priest = User::find($priestId);
        if (!$priest || !$priest->isPriest()) {
            return response()->json(['success' => false, 'message' => 'Priest not found.'], 404);
        }

        return $this->saveEntry($request, $priest, null, $request->user());
    }

    public function destroy(Request $request, $priestId, $id): JsonResponse
    {
        $entry = PriestTimeOff::where('priest_id', $priestId)->find($id);
        if (!$entry) {
            return response()->json(['success' => false, 'message' => 'Time off entry not found.'], 404);
        }

        return $this->deleteEntry($entry, $request->user());
    }

    /**
     * Upcoming services whose assigned priest is unavailable at that date/time,
     * e.g. because time off was added after the assignment.
     */
    public function assignmentConflicts(): JsonResponse
    {
        User::releaseExpiredUnavailability();

        $today = Carbon::today()->toDateString();
        $nowTime = Carbon::now()->format('H:i');

        $requests = ManageRequest::query()
            ->whereNotNull('assigned_priest')
            ->whereIn('status', ['pending', 'approved'])
            ->whereDate('preferred_date', '>=', $today)
            ->with(['service:service_id,service_type,category', 'assignedPriest', 'user:user_id,first_name,middle_name,last_name'])
            ->orderBy('preferred_date')
            ->orderBy('preferred_time')
            ->limit(500)
            ->get();

        $conflicts = $requests
            ->filter(function (ManageRequest $r) use ($today, $nowTime) {
                if ($r->service && ($r->service->category === 'certificate' || $r->certificate_form_id)) {
                    return false;
                }
                $date = Carbon::parse($r->preferred_date)->toDateString();
                $time = ManageRequest::normalizeTime($r->preferred_time);
                return !($date === $today && $time !== '' && $time <= $nowTime);
            })
            ->map(function (ManageRequest $r) {
                $priest = $r->assignedPriest;
                if (!$priest) {
                    return null;
                }
                $date = Carbon::parse($r->preferred_date)->toDateString();
                $time = ManageRequest::normalizeTime($r->preferred_time);
                $problem = $priest->availabilityProblem($date, $time ?: null);
                if ($problem === null) {
                    return null;
                }

                return [
                    'request_id' => $r->request_id,
                    'date' => $date,
                    'time' => $time,
                    'status' => $r->status,
                    'service_type' => $r->service?->service_type ?? 'Service',
                    'requested_by' => $r->user ? trim($r->user->full_name) : null,
                    'priest_id' => $priest->user_id,
                    'priest_name' => trim($priest->full_name),
                    'problem' => $problem,
                ];
            })
            ->filter()
            ->values();

        return response()->json([
            'success' => true,
            'data' => [
                'count' => $conflicts->count(),
                'items' => $conflicts,
            ],
        ]);
    }

    // ============ Shared ============

    private function saveEntry(Request $request, User $priest, ?PriestTimeOff $entry, User $actor): JsonResponse
    {
        $today = Carbon::today()->toDateString();

        if ($entry && $entry->end_date->toDateString() < $today) {
            return response()->json(['success' => false, 'message' => 'Past time off cannot be changed.'], 422);
        }

        // An ongoing entry may keep its original (past) start date
        $minStart = $entry && $entry->start_date->toDateString() < $today
            ? $entry->start_date->toDateString()
            : $today;

        $validator = Validator::make($request->all(), [
            'start_date' => 'required|date_format:Y-m-d|after_or_equal:' . $minStart,
            'end_date' => 'required|date_format:Y-m-d|after_or_equal:start_date|after_or_equal:' . $today,
            'whole_day' => 'required|boolean',
            'start_time' => ['nullable', 'required_if:whole_day,false,0', 'in:' . implode(',', ManageRequest::SERVICE_TIME_SLOTS)],
            'end_time' => ['nullable', 'required_if:whole_day,false,0', 'in:' . implode(',', self::END_TIMES)],
            'reason' => 'nullable|string|max:255',
            'confirm' => 'nullable|boolean',
        ], [
            'start_date.after_or_equal' => 'The start date cannot be in the past.',
            'end_date.after_or_equal' => 'The end date cannot be before the start date or in the past.',
            'start_time.required_if' => 'Choose the start time, or mark it as a whole day.',
            'end_time.required_if' => 'Choose the end time, or mark it as a whole day.',
            'start_time.in' => 'Choose a start time between 8:00 AM and 5:00 PM.',
            'end_time.in' => 'Choose an end time between 9:00 AM and 6:00 PM.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');
        $wholeDay = $request->boolean('whole_day');
        $startTime = $wholeDay ? null : $request->input('start_time');
        $endTime = $wholeDay ? null : $request->input('end_time');

        if (!$wholeDay && $endTime <= $startTime) {
            return response()->json(['success' => false, 'message' => 'The end time must be after the start time.'], 422);
        }

        if (Carbon::parse($startDate)->diffInDays(Carbon::parse($endDate)) > self::MAX_SPAN_DAYS) {
            return response()->json(['success' => false, 'message' => 'Time off can cover at most 3 months per entry.'], 422);
        }

        $overlap = PriestTimeOff::query()
            ->where('priest_id', $priest->user_id)
            ->when($entry, fn ($q) => $q->where('time_off_id', '!=', $entry->time_off_id))
            ->overlapping($startDate, $endDate)
            ->get()
            ->first(function (PriestTimeOff $other) use ($wholeDay, $startTime, $endTime) {
                if ($wholeDay || $other->isWholeDay()) {
                    return true;
                }
                return $startTime < $other->end_time && $other->start_time < $endTime;
            });

        if ($overlap) {
            return response()->json([
                'success' => false,
                'message' => "This overlaps existing time off ({$overlap->label}). Edit or remove that entry instead.",
            ], 422);
        }

        $candidate = new PriestTimeOff([
            'priest_id' => $priest->user_id,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'start_time' => $startTime,
            'end_time' => $endTime,
        ]);
        $conflicts = $this->assignmentsCoveredBy($priest, $candidate);

        if ($conflicts->isNotEmpty() && !$request->boolean('confirm')) {
            return response()->json([
                'success' => false,
                'requires_confirmation' => true,
                'message' => $conflicts->count() === 1
                    ? 'This time off covers 1 service already assigned to this priest.'
                    : "This time off covers {$conflicts->count()} services already assigned to this priest.",
                'conflicts' => $conflicts->values(),
            ], 409);
        }

        $data = [
            'priest_id' => $priest->user_id,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'start_time' => $startTime,
            'end_time' => $endTime,
            'reason' => $request->filled('reason') ? trim((string) $request->input('reason')) : null,
        ];

        if ($entry) {
            $entry->update($data);
        } else {
            $entry = PriestTimeOff::create($data + ['created_by' => $actor->user_id]);
        }

        $entry->load(['priest:user_id,first_name,middle_name,last_name', 'createdBy:user_id,first_name,middle_name,last_name']);

        $actedForPriest = (int) $actor->user_id !== (int) $priest->user_id;
        if ($actedForPriest) {
            $this->notifyPriest(
                $priest,
                'Time off added by the parish office',
                "The parish office marked you unavailable: {$entry->label}" . ($entry->reason ? " ({$entry->reason})" : '') . '.'
            );
        }

        Log::info('Priest time off saved', [
            'time_off_id' => $entry->time_off_id,
            'priest_id' => $priest->user_id,
            'actor_id' => $actor->user_id,
            'label' => $entry->label,
            'conflicts' => $conflicts->pluck('request_id')->all(),
        ]);

        $message = 'Time off saved: ' . $entry->label . '.';
        if ($conflicts->isNotEmpty()) {
            $message .= $actedForPriest
                ? " {$conflicts->count()} assigned service(s) now need a new priest."
                : " The secretary will see {$conflicts->count()} service(s) that need a new priest.";
        }

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $entry->toApiArray(),
            'conflicts' => $conflicts->values(),
        ], 200);
    }

    private function deleteEntry(PriestTimeOff $entry, User $actor): JsonResponse
    {
        if ($entry->end_date->toDateString() < Carbon::today()->toDateString()) {
            return response()->json(['success' => false, 'message' => 'Past time off is kept for records and cannot be removed.'], 422);
        }

        $label = $entry->label;
        $priest = $entry->priest;
        $entry->delete();

        if ($priest && (int) $actor->user_id !== (int) $priest->user_id) {
            $this->notifyPriest($priest, 'Time off removed by the parish office', "The parish office removed your time off: {$label}.");
        }

        Log::info('Priest time off removed', ['priest_id' => $priest?->user_id, 'actor_id' => $actor->user_id, 'label' => $label]);

        return response()->json(['success' => true, 'message' => "Time off removed: {$label}."]);
    }

    /** Upcoming pending/approved services assigned to $priest that the entry would block. */
    private function assignmentsCoveredBy(User $priest, PriestTimeOff $entry): Collection
    {
        $today = Carbon::today()->toDateString();
        $from = max($entry->start_date->toDateString(), $today);
        $nowTime = Carbon::now()->format('H:i');

        return ManageRequest::query()
            ->where('assigned_priest', $priest->user_id)
            ->whereIn('status', ['pending', 'approved'])
            ->whereDate('preferred_date', '>=', $from)
            ->whereDate('preferred_date', '<=', $entry->end_date->toDateString())
            ->with(['service:service_id,service_type,category', 'user:user_id,first_name,middle_name,last_name'])
            ->orderBy('preferred_date')
            ->orderBy('preferred_time')
            ->get()
            ->filter(function (ManageRequest $r) use ($entry, $today, $nowTime) {
                if ($r->service && ($r->service->category === 'certificate' || $r->certificate_form_id)) {
                    return false;
                }
                $date = Carbon::parse($r->preferred_date)->toDateString();
                $time = ManageRequest::normalizeTime($r->preferred_time);
                if ($date === $today && $time !== '' && $time <= $nowTime) {
                    return false;
                }
                return $entry->covers($date, $time ?: null);
            })
            ->map(fn (ManageRequest $r) => [
                'request_id' => $r->request_id,
                'date' => Carbon::parse($r->preferred_date)->toDateString(),
                'time' => ManageRequest::normalizeTime($r->preferred_time),
                'service_type' => $r->service?->service_type ?? 'Service',
                'status' => $r->status,
                'requested_by' => $r->user ? trim($r->user->full_name) : null,
            ])
            ->values();
    }

    private function notifyPriest(User $priest, string $title, string $message): void
    {
        try {
            Notification::create([
                'user_id' => $priest->user_id,
                'request_id' => null,
                'type' => 'priest_time_off',
                'title' => $title,
                'message' => $message,
            ]);
        } catch (\Exception $e) {
            Log::warning('Could not notify priest about time off', ['priest_id' => $priest->user_id, 'error' => $e->getMessage()]);
        }
    }
}
