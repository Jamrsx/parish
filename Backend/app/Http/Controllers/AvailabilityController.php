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
     * Get availability for all services
     */
    public function getAvailability(Request $request)
    {
        try {
            $date = $request->has('date') 
                ? Carbon::parse($request->date) 
                : Carbon::today();

            // Define services to display
            $serviceConfigs = [
                'baptism' => [
                    'name' => 'Baptism',
                    'icon' => 'Droplets',
                    'description' => 'Holy Baptism for infants and adults',
                    'navigateTo' => '/baptism-form',
                ],
                'funeral_mass' => [
                    'name' => 'Funeral Mass',
                    'icon' => 'Cross',
                    'description' => 'Christian burial and memorial service',
                    'navigateTo' => '/service-form',
                ],
                'marriage' => [
                    'name' => 'Marriage',
                    'icon' => 'Heart',
                    'description' => 'Holy Matrimony wedding ceremony',
                    'navigateTo' => '/service-form',
                ],
                'house_blessing' => [
                    'name' => 'House Blessing',
                    'icon' => 'Home',
                    'description' => 'Blessing of new home or special occasion',
                    'navigateTo' => '/service-form',
                ]
            ];

            $availability = [];

            foreach ($serviceConfigs as $key => $config) {
                // Get the church service from database
                $churchService = ChurchService::where('service_type', $config['name'])->first();
                
                if (!$churchService) {
                    Log::warning("Church service not found: " . $config['name']);
                    continue;
                }

                $status = $churchService->getAvailabilityStatus($date);
                
                $nextAvailableDate = $status['isAvailable'] 
                    ? $date->copy()->addDay()->format('F j, Y')
                    : $churchService->findNextAvailableDate($date);

                $availability[] = [
                    'id' => $key,
                    'name' => $config['name'],
                    'icon' => $config['icon'],
                    'description' => $config['description'],
                    'navigateTo' => $config['navigateTo'],
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

            // Certificates data
            $certificates = [
                [
                    'id' => 1,
                    'title' => 'Baptismal Certificate',
                    'description' => 'Official record of Holy Baptism',
                    'processingTime' => '3–5 business days',
                    'timeColor' => 'blue',
                    'navigateTo' => '/certificate-request'
                ],
                [
                    'id' => 2,
                    'title' => 'Marriage Certificate',
                    'description' => 'Official record of Holy Matrimony',
                    'processingTime' => '5–7 business days',
                    'timeColor' => 'green',
                    'navigateTo' => '/certificate-request'
                ],
            ];

            return response()->json([
                'success' => true,
                'data' => [
                    'services' => $availability,
                    'certificates' => $certificates,
                    'date' => $date->format('Y-m-d'), 
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error in AvailabilityController: ' . $e->getMessage());
            Log::error($e->getTraceAsString());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch availability: ' . $e->getMessage()
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
                    'message' => 'Service not found.'
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
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error in getServiceAvailability: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch service availability.'
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
                    'errors' => $validator->errors()
                ], 422);
            }

            $churchService = ChurchService::find($request->service_id);
            
            if (!$churchService) {
                return response()->json([
                    'success' => false,
                    'message' => 'Service not found.'
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
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error in getAvailabilityRange: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch availability range.'
            ], 500);
        }
    }
}