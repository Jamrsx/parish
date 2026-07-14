<?php

namespace App\Http\Controllers;

use App\Models\ChurchService;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class ChurchServiceController extends Controller
{
    /**
     * Display a listing of church services.
     */
    public function index(Request $request)
    {
        $query = ChurchService::query();

        // Filter by search term
        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where('service_type', 'LIKE', "%{$search}%");  // ✅ Fixed
        }

        // Filter by service type
        if ($request->has('type') && !empty($request->type)) {
            switch ($request->type) {
                case 'baptism':
                    $query->baptism();
                    break;
                case 'certificate':
                    $query->certificates();
                    break;
                case 'service_form':
                    $query->usesServiceForm();
                    break;
            }
        }

        // Order by service type
        $services = $query->orderBy('service_type', 'asc')  // ✅ Fixed
                          ->paginate($request->per_page ?? 15);

        // Add additional attributes to each service
        $services->getCollection()->transform(function ($service) {
            return $this->enrichServiceData($service);
        });

        return response()->json([
            'success' => true,
            'data' => $services,
        ]);
    }

    /**
     * Get all services as options (for dropdowns).
     */
    public function getOptions(Request $request)
    {
        $services = ChurchService::orderBy('service_type', 'asc')->get();  // ✅ Fixed

        // Group services by type
        $grouped = [
            'baptism' => $services->filter(function ($service) {
                return $service->isBaptism();
            })->values(),
            'certificate' => $services->filter(function ($service) {
                return $service->isCertificate();
            })->values(),
            'service_form' => $services->filter(function ($service) {
                return $service->usesServiceForm();
            })->values(),
            'all' => $services->map(function ($service) {
                return $this->enrichServiceData($service);
            })
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'all' => $services->map(function ($service) {
                    return $this->enrichServiceData($service);
                }),
                'grouped' => [
                    'baptism' => $grouped['baptism']->map(function ($service) {
                        return $this->enrichServiceData($service);
                    }),
                    'certificate' => $grouped['certificate']->map(function ($service) {
                        return $this->enrichServiceData($service);
                    }),
                    'service_form' => $grouped['service_form']->map(function ($service) {
                        return $this->enrichServiceData($service);
                    }),
                ]
            ]
        ]);
    }

    /**
     * Store a newly created church service.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'service_type' => 'required|string|max:100|unique:church_services,service_type',
            'description' => 'nullable|string|max:255',
            'icon' => 'nullable|string|max:50',
            'category' => 'required|in:service,certificate',
            'fee' => 'required|numeric|min:0',
            'available_slots' => 'required|integer|min:1',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
                'message' => 'Please check the service details.',
            ], 422);
        }

        $service = ChurchService::create([
            'service_type' => $request->service_type,
            'description' => $request->description,
            'icon' => $request->icon ?: 'Church',
            'category' => $request->category,
            'form_handler' => 'generic',
            'fee' => $request->fee,
            'available_slots' => $request->available_slots,
            'is_active' => $request->boolean('is_active', true),
            'is_system' => false,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Church service created successfully. It will appear on the parishioner app.',
            'data' => $this->enrichServiceData($service),
        ], 201);
    }

    /**
     * Display the specified church service.
     */
    public function show($id)
    {
        try {
            $service = ChurchService::with(['requests' => function($query) {
                $query->orderBy('created_at', 'desc')->limit(10);
            }])->findOrFail($id);

            // Get request statistics
            $requestStats = [
                'total' => $service->requests()->count(),
                'pending' => $service->pendingRequests()->count(),
                'approved' => $service->approvedRequests()->count(),
                'completed' => $service->completedRequests()->count(),
                'cancelled' => $service->cancelledRequests()->count(),
            ];

            return response()->json([
                'success' => true,
                'data' => [
                    'service' => $this->enrichServiceData($service),
                    'request_statistics' => $requestStats,
                    'recent_requests' => $service->requests()->with(['user'])->limit(10)->get(),
                    'availability' => [
                        'daily_limit' => $service->getDailyLimit(),
                        'today_bookings' => $service->getBookingsCount(),
                        'today_remaining' => $service->getRemainingSlots(),
                        'is_available_today' => $service->isAvailable(),
                    ]
                ]
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Church service not found.'
            ], 404);
        }
    }

    /**
     * Update the specified church service.
     */
    public function update(Request $request, $id)
    {
        try {
            $service = ChurchService::findOrFail($id);

            $validator = Validator::make($request->all(), [
                'service_type' => 'sometimes|required|string|max:100|unique:church_services,service_type,' . $id . ',service_id',
                'description' => 'nullable|string|max:255',
                'icon' => 'nullable|string|max:50',
                'category' => 'sometimes|required|in:service,certificate',
                'fee' => 'sometimes|required|numeric|min:0',
                'available_slots' => 'nullable|integer|min:0',
                'is_active' => 'sometimes|boolean',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            $payload = $request->only([
                'service_type',
                'description',
                'icon',
                'category',
                'fee',
                'available_slots',
                'is_active',
            ]);

            // System services keep their specialized form handlers
            if ($service->is_system) {
                unset($payload['category']);
            }

            $service->update($payload);

            return response()->json([
                'success' => true,
                'message' => 'Church service updated successfully.',
                'data' => $this->enrichServiceData($service->fresh()),
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Church service not found.'
            ], 404);
        }
    }

    /**
     * Update available slots for a service.
     */
    public function updateSlots(Request $request, $id)
    {
        try {
            $service = ChurchService::findOrFail($id);

            $validator = Validator::make($request->all(), [
                'available_slots' => 'required|integer|min:0',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            $service->update(['available_slots' => $request->available_slots]);

            return response()->json([
                'success' => true,
                'message' => 'Service slots updated successfully.',
                'data' => [
                    'service_id' => $service->service_id,
                    'service_type' => $service->service_type,  // ✅ Fixed
                    'available_slots' => $service->available_slots,
                    'daily_limit' => $service->getDailyLimit(),
                ]
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Church service not found.'
            ], 404);
        }
    }

    /**
     * Get slot availability for a service.
     */
    public function getSlots($id, Request $request)
    {
        try {
            $service = ChurchService::findOrFail($id);
            
            $date = $request->has('date') ? $request->date : null;
            
            return response()->json([
                'success' => true,
                'data' => [
                    'service_id' => $service->service_id,
                    'service_type' => $service->service_type,  // ✅ Fixed
                    'daily_limit' => $service->getDailyLimit(),
                    'available_slots_db' => $service->available_slots,
                    'status' => $service->getAvailabilityStatus($date),
                    'next_available' => $service->findNextAvailableDate(),
                ]
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Church service not found.'
            ], 404);
        }
    }

    /**
     * Remove the specified church service.
     */
    public function destroy($id)
    {
        try {
            $service = ChurchService::findOrFail($id);

            // Prefer deactivate over hard delete when requests exist or system service
            if ($service->is_system || $service->requests()->count() > 0) {
                $service->update(['is_active' => false]);

                return response()->json([
                    'success' => true,
                    'message' => 'Service deactivated. Existing requests were kept.',
                    'data' => $this->enrichServiceData($service->fresh()),
                ]);
            }

            $service->delete();

            return response()->json([
                'success' => true,
                'message' => 'Church service deleted successfully.'
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Church service not found.'
            ], 404);
        }
    }

    /**
     * Get a church service by name.
     */
    public function getByName($name)
    {
        $service = ChurchService::where('service_type', $name)->first();  // ✅ Fixed

        if (!$service) {
            return response()->json([
                'success' => false,
                'message' => 'Church service not found.'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $this->enrichServiceData($service),
        ]);
    }

    /**
     * Get church service statistics.
     */
    public function getStatistics()
    {
        $services = ChurchService::all();
        $totalServices = $services->count();

        // Fee statistics
        $fees = $services->pluck('fee');
        $feeStats = [
            'min' => $fees->min() ?? 0,
            'max' => $fees->max() ?? 0,
            'average' => $fees->avg() ?? 0,
        ];

        // Most requested services
        $mostRequested = ChurchService::withCount('requests')
            ->having('requests_count', '>', 0)
            ->orderBy('requests_count', 'desc')
            ->limit(5)
            ->get()
            ->map(function ($service) {
                return $this->enrichServiceData($service);
            });

        // All services with request counts
        $allServicesWithCounts = $services->map(function ($service) {
            $enriched = $this->enrichServiceData($service);
            $enriched['requests_count'] = $service->requests()->count();
            $enriched['pending_count'] = $service->pendingRequests()->count();
            $enriched['approved_count'] = $service->approvedRequests()->count();
            $enriched['completed_count'] = $service->completedRequests()->count();
            $enriched['cancelled_count'] = $service->cancelledRequests()->count();
            $enriched['daily_limit'] = $service->getDailyLimit();
            $enriched['today_bookings'] = $service->getBookingsCount();
            $enriched['today_remaining'] = $service->getRemainingSlots();
            return $enriched;
        });

        return response()->json([
            'success' => true,
            'data' => [
                'total_services' => $totalServices,
                'fee_statistics' => $feeStats,
                'most_requested' => $mostRequested,
                'all_services_with_counts' => $allServicesWithCounts,
            ]
        ]);
    }

    /**
     * Enrich service data with additional attributes.
     */
    private function enrichServiceData($service)
    {
        $serviceData = $service->toArray();
        $serviceData['service_name'] = $service->service_type; 
        $serviceData['formatted_fee'] = $service->formatted_fee;
        $serviceData['form_type'] = $service->form_type;
        $serviceData['required_form'] = $service->required_form;
        $serviceData['is_baptism'] = $service->isBaptism();
        $serviceData['is_certificate'] = $service->isCertificate();
        $serviceData['uses_service_form'] = $service->usesServiceForm();
        $serviceData['is_active'] = (bool) $service->is_active;
        $serviceData['is_system'] = (bool) $service->is_system;
        $serviceData['description'] = $service->description;
        $serviceData['icon'] = $service->icon;
        $serviceData['category'] = $service->category ?: 'service';
        $serviceData['form_handler'] = $service->form_handler ?: 'generic';
        $serviceData['navigate_path'] = $service->navigate_path;
        $serviceData['requests_count'] = $service->requests()->count();
        $serviceData['daily_limit'] = $service->getDailyLimit();
        $serviceData['today_bookings'] = $service->getBookingsCount();
        $serviceData['today_remaining'] = $service->getRemainingSlots();
        $serviceData['is_available_today'] = $service->isAvailable();
        
        return $serviceData;
    }

    /**
     * Get services by form type.
     */
    public function getByFormType($formType)
    {
        $validTypes = ['baptism', 'certificate', 'service_form'];
        
        if (!in_array($formType, $validTypes)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid form type. Allowed: ' . implode(', ', $validTypes)
            ], 400);
        }

        $query = ChurchService::query();
        
        switch ($formType) {
            case 'baptism':
                $query->baptism();
                break;
            case 'certificate':
                $query->certificates();
                break;
            case 'service_form':
                $query->usesServiceForm();
                break;
        }

        $services = $query->orderBy('service_type', 'asc')->get();  // ✅ Fixed

        return response()->json([
            'success' => true,
            'data' => $services->map(function ($service) {
                return $this->enrichServiceData($service);
            })
        ]);
    }

    /**
     * Bulk delete church services.
     */
    public function bulkDelete(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'service_ids' => 'required|array|min:1',
            'service_ids.*' => 'required|integer|exists:church_services,service_id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $deleted = 0;
        $errors = [];

        foreach ($request->service_ids as $serviceId) {
            try {
                $service = ChurchService::findOrFail($serviceId);
                
                if ($service->requests()->count() > 0) {
                    $errors[] = "Service '{$service->service_type}' has existing requests and cannot be deleted.";  // ✅ Fixed
                    continue;
                }
                
                $service->delete();
                $deleted++;
            } catch (ModelNotFoundException $e) {
                $errors[] = "Service ID {$serviceId} not found.";
            }
        }

        return response()->json([
            'success' => true,
            'message' => "{$deleted} service(s) deleted successfully.",
            'data' => [
                'deleted_count' => $deleted,
                'errors' => $errors,
            ]
        ]);
    }

    /**
     * Get services with their request counts.
     */
    public function getWithRequestCounts()
    {
        $services = ChurchService::withCount('requests')
            ->orderBy('requests_count', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $services->map(function ($service) {
                $enriched = $this->enrichServiceData($service);
                $enriched['requests_count'] = $service->requests_count;
                return $enriched;
            })
        ]);
    }

    /**
     * Get service fee structure.
     */
    public function getFeeStructure()
    {
        $services = ChurchService::select('service_id', 'service_type', 'fee', 'available_slots')  // ✅ Fixed
            ->orderBy('service_type', 'asc')  // ✅ Fixed
            ->get();

        return response()->json([
            'success' => true,
            'data' => $services->map(function ($service) {
                return [
                    'service_id' => $service->service_id,
                    'service_name' => $service->service_type,  // ✅ Map for frontend
                    'fee' => $service->fee,
                    'formatted_fee' => $service->formatted_fee,
                    'available_slots' => $service->available_slots,
                    'daily_limit' => $service->getDailyLimit(),
                ];
            })
        ]);
    }

    /**
     * Update service fee.
     */
    public function updateFee(Request $request, $id)
    {
        try {
            $service = ChurchService::findOrFail($id);

            $validator = Validator::make($request->all(), [
                'fee' => 'required|numeric|min:0',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            $service->update(['fee' => $request->fee]);

            return response()->json([
                'success' => true,
                'message' => 'Service fee updated successfully.',
                'data' => $this->enrichServiceData($service),
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Church service not found.'
            ], 404);
        }
    }
}