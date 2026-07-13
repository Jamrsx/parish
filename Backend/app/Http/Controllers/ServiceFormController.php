<?php

namespace App\Http\Controllers;

use App\Models\ServiceForm;
use App\Models\ChurchService;
use App\Models\ManageRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Carbon\Carbon;

class ServiceFormController extends Controller
{
    /**
     * Display a listing of service forms with filters.
     */
    public function index(Request $request)
    {
        $query = ServiceForm::with(['request', 'request.service', 'request.user', 'churchService']);
        
        if ($request->has('service_id') && !empty($request->service_id)) {
            $query->where('service_id', $request->service_id);
        }
        
        // ✅ Filter by service_type through relationship
        if ($request->has('service_type') && $request->service_type !== 'all') {
            $query->whereHas('churchService', function ($q) use ($request) {
                $q->where('service_type', $request->service_type);
            });
        }
        
        // Filter by status (through the request)
        if ($request->has('status') && $request->status !== 'all') {
            $query->whereHas('request', function ($q) use ($request) {
                $q->where('status', $request->status);
            });
        }
        
        // ✅ Search by name, contact, or address (search through relationship for service type)
        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('full_name', 'LIKE', "%{$search}%")
                  ->orWhere('contact_number', 'LIKE', "%{$search}%")
                  ->orWhere('address', 'LIKE', "%{$search}%")
                  ->orWhereHas('churchService', function($subQ) use ($search) {
                      $subQ->where('service_type', 'LIKE', "%{$search}%");
                  });
            });
        }
        
        // Filter by date range (preferred date through request)
        if ($request->has('date_from')) {
            $query->whereHas('request', function ($q) use ($request) {
                $q->whereDate('preferred_date', '>=', $request->date_from);
            });
        }
        if ($request->has('date_to')) {
            $query->whereHas('request', function ($q) use ($request) {
                $q->whereDate('preferred_date', '<=', $request->date_to);
            });
        }

        // Filter by preferred date range (directly from service_forms)
        if ($request->has('preferred_from_date') && $request->has('preferred_to_date')) {
            $query->whereBetween('preferred_date', [$request->preferred_from_date, $request->preferred_to_date]);
        }
        
        $forms = $query->orderBy('created_at', 'desc')->paginate($request->per_page ?? 15);
        
        return response()->json([
            'success' => true,
            'data' => $forms
        ]);
    }

    /**
     * Get available services for dropdown
     */
    public function getAvailableServices()
    {
        $services = ChurchService::whereIn('service_type', ['Marriage', 'Funeral Mass', 'House Blessing'])
            ->orderBy('service_type', 'asc') 
            ->get();

        return response()->json([
            'success' => true,
            'data' => $services->map(function ($service) {
                return [
                    'service_id' => $service->service_id,
                    'service_type' => $service->service_type,
                    'fee' => $service->fee,
                    'formatted_fee' => $service->formatted_fee,
                ];
            })
        ]);
    }

    /**
     * Store a newly created service form in storage.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'service_id' => 'required|exists:church_services,service_id',
            'full_name' => 'required|string|max:100',
            'address' => 'required|string|max:1000',
            'contact_number' => 'required|string|max:20',
            'preferred_date' => 'required|date|after_or_equal:today',
            'preferred_time' => 'required|date_format:H:i',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        // ✅ Get service by ID
        $churchService = ChurchService::find($request->service_id);
        
        if (!$churchService) {
            return response()->json([
                'success' => false,
                'message' => 'Service not configured. Please contact the parish office.'
            ], 404);
        }

        $quotaError = $churchService->validateTodaySubmissionQuota();
        if ($quotaError) {
            $nextAvailable = $churchService->findNextAvailableDate();

            return response()->json([
                'success' => false,
                'message' => $quotaError,
                'data' => [
                    'next_available_date' => $nextAvailable,
                    'remaining_slots' => $churchService->getRemainingSlots(),
                    'daily_limit' => $churchService->getDailyLimit(),
                ]
            ], 422);
        }

        $scheduleError = ManageRequest::validateGlobalSchedule(
            $request->preferred_date,
            $request->preferred_time
        );

        if ($scheduleError) {
            return response()->json([
                'success' => false,
                'message' => $scheduleError,
            ], 422);
        }

        try {
            DB::beginTransaction();
            
            $serviceForm = ServiceForm::create([
                'service_id' => $request->service_id,
                'full_name' => $request->full_name,
                'address' => $request->address,
                'contact_number' => $request->contact_number,
                'preferred_date' => $request->preferred_date,
                'preferred_time' => $request->preferred_time
            ]);
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => 'Service form created successfully',
                'data' => $serviceForm->load(['request', 'request.service', 'churchService'])
            ], 201);
            
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to create service form: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified service form.
     */
    public function show($id)
    {
        try {
            $serviceForm = ServiceForm::with([
                'request',
                'request.user',
                'request.service',
                'request.processedBy',
                'request.assignedPriest',
                'churchService'
            ])->findOrFail($id);
            
            return response()->json([
                'success' => true,
                'data' => $serviceForm
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Service form not found'
            ], 404);
        }
    }

    /**
     * Update the specified service form.
     */
    public function update(Request $request, $id)
    {
        try {
            $serviceForm = ServiceForm::findOrFail($id);
            
            $validator = Validator::make($request->all(), [
                'full_name' => 'sometimes|string|max:100',
                'address' => 'sometimes|string|max:1000',
                'contact_number' => 'sometimes|string|max:20',
                'preferred_date' => 'sometimes|required|date|after_or_equal:today',
                'preferred_time' => 'sometimes|required|date_format:H:i',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            $serviceForm->update($request->only([
                'full_name',
                'address',
                'contact_number',
                'preferred_date',
                'preferred_time'
            ]));
            
            return response()->json([
                'success' => true,
                'message' => 'Service form updated successfully',
                'data' => $serviceForm->fresh(['request', 'request.service', 'churchService'])
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Service form not found'
            ], 404);
        }
    }

    /**
     * Remove the specified service form.
     */
    public function destroy($id)
    {
        try {
            $serviceForm = ServiceForm::findOrFail($id);
            
            DB::beginTransaction();
            
            // Delete the associated request if exists
            if ($serviceForm->request) {
                $serviceForm->request->delete();
            }
            
            $serviceForm->delete();
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => 'Service form deleted successfully'
            ]);
            
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Service form not found'
            ], 404);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete service form: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get service forms by service type.
     */
    public function getByServiceType($serviceType)
    {
        $validTypes = ['Marriage', 'Funeral Mass', 'House Blessing'];
        
        if (!in_array($serviceType, $validTypes)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid service type. Allowed: ' . implode(', ', $validTypes)
            ], 400);
        }
        
        // ✅ Use service_type through churchService relationship
        $forms = ServiceForm::with(['request', 'request.user', 'churchService'])
            ->whereHas('churchService', function($q) use ($serviceType) {
                $q->where('service_type', $serviceType); 
            })
            ->orderBy('created_at', 'desc')
            ->get();
            
        return response()->json([
            'success' => true,
            'data' => $forms
        ]);
    }

    /**
     * Get statistics for service forms.
     */
    public function getStats()
    {
        $serviceForms = ServiceForm::with('churchService')->get();
        
        $byService = $serviceForms->groupBy('service_id')
            ->map(function ($group) {
                $first = $group->first();
                return [
                    'service_id' => $first->service_id,
                    'service_type' => $first->churchService?->service_type ?? 'Unknown',
                    'total' => $group->count(),
                    'fee' => $first->churchService?->fee ?? 0,
                    'formatted_fee' => $first->churchService?->formatted_fee ?? '₱0.00',
                ];
            })
            ->values();

        $stats = [
            'total' => ServiceForm::count(),
            'with_requests' => ServiceForm::has('request')->count(),
            'without_requests' => ServiceForm::doesntHave('request')->count(),
            'by_service' => $byService,
            'by_status' => [
                'pending' => ServiceForm::whereHas('request', function($q) {
                    $q->where('status', 'pending');
                })->count(),
                'approved' => ServiceForm::whereHas('request', function($q) {
                    $q->where('status', 'approved');
                })->count(),
                'ongoing' => ServiceForm::whereHas('request', function($q) {  
                    $q->where('status', 'ongoing');
                })->count(),
                'done' => ServiceForm::whereHas('request', function($q) {
                    $q->where('status', 'done');
                })->count(),
                'cancelled' => ServiceForm::whereHas('request', function($q) {
                    $q->where('status', 'cancelled');
                })->count()
            ],
            'recent' => ServiceForm::with(['request', 'request.service', 'churchService'])
                ->orderBy('created_at', 'desc')
                ->limit(10)
                ->get()
        ];
        
        return response()->json([
            'success' => true,
            'data' => $stats
        ]);
    }

    /**
     * Search service forms.
     */
    public function search(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'query' => 'required|string|min:2'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }
        
        $query = $request->query;
        
        // ✅ Search through relationship for service type
        $forms = ServiceForm::with(['request', 'request.service', 'churchService'])
            ->where(function($q) use ($query) {
                $q->where('full_name', 'LIKE', "%{$query}%")
                  ->orWhere('contact_number', 'LIKE', "%{$query}%")
                  ->orWhere('address', 'LIKE', "%{$query}%")
                  ->orWhereHas('churchService', function($subQ) use ($query) {
                      $subQ->where('service_type', 'LIKE', "%{$query}%");
                  });
            })
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get();
            
        return response()->json([
            'success' => true,
            'data' => $forms
        ]);
    }

    /**
     * Get upcoming service forms.
     */
    public function getUpcoming()
    {
        $today = now()->toDateString();
        
        $forms = ServiceForm::with(['request', 'request.service', 'request.user', 'churchService'])
            ->where('preferred_date', '>=', $today)
            ->orderBy('preferred_date', 'asc')
            ->orderBy('preferred_time', 'asc')
            ->limit(20)
            ->get();
            
        return response()->json([
            'success' => true,
            'data' => $forms
        ]);
    }

    /**
     * Get forms by preferred date range.
     */
    public function getByDateRange(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }
        
        $forms = ServiceForm::with(['request', 'request.service', 'churchService'])
            ->whereBetween('preferred_date', [$request->start_date, $request->end_date])
            ->orderBy('preferred_date', 'asc')
            ->orderBy('preferred_time', 'asc')
            ->get();
            
        return response()->json([
            'success' => true,
            'data' => $forms
        ]);
    }

    /**
     * Export service forms data.
     */
    public function export(Request $request)
    {
        $query = ServiceForm::with(['request', 'request.service', 'churchService']);
        
        if ($request->has('service_id') && !empty($request->service_id)) {
            $query->where('service_id', $request->service_id);
        }
        
        if ($request->has('service_type') && !empty($request->service_type)) {
            $query->whereHas('churchService', function ($q) use ($request) {
                $q->where('service_type', $request->service_type);
            });
        }
        
        if ($request->has('status')) {
            $query->whereHas('request', function ($q) use ($request) {
                $q->where('status', $request->status);
            });
        }
        
        $forms = $query->get();
        
        $exportData = $forms->map(function ($form) {
            return [
                'ID' => $form->serviceform_id,
                'Service Type' => $form->churchService?->service_type ?? 'N/A',
                'Full Name' => $form->full_name,
                'Address' => $form->address,
                'Contact Number' => $form->contact_number,
                'Service Fee' => $form->formatted_fee ?? 'N/A',
                'Preferred Date' => $form->preferred_date ? date('Y-m-d', strtotime($form->preferred_date)) : null,
                'Preferred Time' => $form->preferred_time ? date('h:i A', strtotime($form->preferred_time)) : null,
                'Status' => $form->request->status ?? 'N/A',
                'Created At' => $form->created_at->format('Y-m-d H:i:s')
            ];
        });
        
        return response()->json([
            'success' => true,
            'data' => $exportData,
            'count' => $exportData->count()
        ]);
    }

    /**
     * Get forms by service ID.
     */
    public function getByServiceId($serviceId)
    {
        $churchService = ChurchService::find($serviceId);
        
        if (!$churchService) {
            return response()->json([
                'success' => false,
                'message' => 'Service not found.'
            ], 404);
        }
        
        $forms = ServiceForm::with(['request', 'request.user', 'churchService'])
            ->where('service_id', $serviceId)
            ->orderBy('created_at', 'desc')
            ->get();
            
        return response()->json([
            'success' => true,
            'data' => [
                'service' => [
                    'id' => $churchService->service_id,
                    'type' => $churchService->service_type,
                ],
                'forms' => $forms
            ]
        ]);
    }
}