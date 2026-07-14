<?php

namespace App\Http\Controllers;

use App\Models\ChurchService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Models\ManageRequest;

class AvailabilityController extends Controller
{
    /**
     * Get availability for all active services from the database.
     */
    public function getAvailability(Request $request)
    {
        try {
            $date = $request->has('date')
                ? Carbon::parse($request->date)
                : Carbon::today();

            $services = ChurchService::query()
                ->active()
                ->where(function ($q) {
                    $q->where('category', 'service')
                        ->orWhereNull('category');
                })
                ->orderBy('service_type')
                ->get();

            $availability = [];

            foreach ($services as $churchService) {
                $status = $churchService->getAvailabilityStatus($date);

                $nextAvailableDate = $status['isAvailable']
                    ? 'Today · ' . $date->format('F j, Y')
                    : ($churchService->findNextAvailableDate($date) ?? 'Contact parish office');

                $availability[] = [
                    'id' => $churchService->service_id,
                    'service_id' => $churchService->service_id,
                    'name' => $churchService->service_type,
                    'icon' => $churchService->icon ?: 'Church',
                    'description' => $churchService->description
                        ?: ($churchService->service_type . ' offered by the parish'),
                    'form_handler' => $churchService->form_handler ?: 'generic',
                    'category' => $churchService->category ?: 'service',
                    'fee' => (float) $churchService->fee,
                    'formatted_fee' => $churchService->formatted_fee,
                    'navigateTo' => $churchService->navigate_path,
                    'status' => $status['status'],
                    'statusColor' => $status['statusColor'],
                    'slotsRemaining' => $status['slotsRemaining'],
                    'nextDate' => $nextAvailableDate ?? 'Contact parish office',
                    'progress' => $status['progress'],
                    'buttonText' => $status['buttonText'],
                    'disabled' => $status['disabled'],
                    'isAvailable' => $status['isAvailable'],
                    'remainingSlots' => $status['remainingSlots'],
                    'dailyLimit' => $status['dailyLimit'],
                    'bookings' => $status['bookings'],
                    'date' => $date->format('Y-m-d'),
                ];
            }

            $certificates = ChurchService::query()
                ->active()
                ->where('category', 'certificate')
                ->orderBy('service_type')
                ->get()
                ->map(function (ChurchService $service) {
                    return [
                        'id' => $service->service_id,
                        'service_id' => $service->service_id,
                        'title' => $service->service_type,
                        'description' => $service->description ?: 'Certificate request',
                        'form_handler' => $service->form_handler ?: 'generic',
                        'fee' => (float) $service->fee,
                        'processingTime' => '3–7 business days',
                        'timeColor' => 'blue',
                        'navigateTo' => $service->navigate_path,
                    ];
                })
                ->values()
                ->all();

            return response()->json([
                'success' => true,
                'data' => [
                    'services' => $availability,
                    'certificates' => $certificates,
                    'date' => $date->format('Y-m-d'),
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Error in AvailabilityController: ' . $e->getMessage());
            Log::error($e->getTraceAsString());

            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch availability: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get booked time slots for a specific date (parish-wide).
     */
    public function getBookedSlots(Request $request)
    {
        try {
            $validator = validator($request->all(), [
                'date' => 'required|date',
                'exclude_request_id' => 'nullable|integer|exists:manage_requests,request_id',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors(),
                ], 422);
            }

            $date = Carbon::parse($request->date)->format('Y-m-d');
            $excludeRequestId = $request->integer('exclude_request_id') ?: null;
            $bookedTimes = ManageRequest::getBookedTimeSlotsForDate($date, $excludeRequestId);

            return response()->json([
                'success' => true,
                'data' => [
                    'date' => $date,
                    'booked_times' => $bookedTimes,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Error in getBookedSlots: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch booked time slots.',
            ], 500);
        }
    }

    /**
     * Get availability for a specific service
     */
    public function getServiceAvailability($serviceType, Request $request)
    {
        try {
            $churchService = ChurchService::where('service_type', $serviceType)->first();

            if (!$churchService) {
                return response()->json([
                    'success' => false,
                    'message' => 'Service not found.',
                ], 404);
            }

            $date = $request->has('date') ? Carbon::parse($request->date) : Carbon::today();

            $status = $churchService->getAvailabilityStatus($date);
            $nextAvailable = $churchService->findNextAvailableDate($date);

            return response()->json([
                'success' => true,
                'data' => [
                    'service' => [
                        'id' => $churchService->service_id,
                        'type' => $churchService->service_type,
                        'fee' => $churchService->fee,
                        'formatted_fee' => $churchService->formatted_fee,
                    ],
                    'availability' => $status,
                    'next_available_date' => $nextAvailable,
                    'date' => $date->format('Y-m-d'),
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Error in getServiceAvailability: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch service availability.',
            ], 500);
        }
    }

    /**
     * Get availability for a date range
     */
    public function getAvailabilityRange(Request $request)
    {
        try {
            $validator = validator($request->all(), [
                'service_id' => 'required|exists:church_services,service_id',
                'start_date' => 'required|date',
                'end_date' => 'required|date|after_or_equal:start_date',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors(),
                ], 422);
            }

            $churchService = ChurchService::find($request->service_id);

            if (!$churchService) {
                return response()->json([
                    'success' => false,
                    'message' => 'Service not found.',
                ], 404);
            }

            $availability = $churchService->getAvailabilityForDateRange(
                $request->start_date,
                $request->end_date
            );

            return response()->json([
                'success' => true,
                'data' => [
                    'service' => [
                        'id' => $churchService->service_id,
                        'type' => $churchService->service_type,
                        'daily_limit' => $churchService->getDailyLimit(),
                    ],
                    'availability' => $availability,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Error in getAvailabilityRange: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch availability range.',
            ], 500);
        }
    }
}
