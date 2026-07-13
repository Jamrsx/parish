<?php

namespace App\Http\Controllers;

use App\Models\CertificateForm;
use App\Models\ChurchService;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Carbon\Carbon;

class CertificateFormController extends Controller
{
    /**
     * Display a listing of certificate forms.
     */
    public function index(Request $request)
    {
        $query = CertificateForm::with(['request', 'request.service', 'request.user', 'churchService']);

        // ✅ Filter by service_id instead of certificate_type
        if ($request->has('service_id') && !empty($request->service_id)) {
            $query->where('service_id', $request->service_id);
        }

        // ✅ Filter by service type through relationship
        if ($request->has('service_type') && !empty($request->service_type)) {
            $query->whereHas('churchService', function($q) use ($request) {
                $q->where('service_type', $request->service_type);
            });
        }

        // Filter by search term (name)
        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('full_name', 'LIKE', "%{$search}%")
                  ->orWhere('contact_number', 'LIKE', "%{$search}%")
                  ->orWhere('address', 'LIKE', "%{$search}%");
            });
        }

        // Filter by date range
        if ($request->has('from_date') && $request->has('to_date')) {
            $query->whereBetween('created_at', [$request->from_date, $request->to_date]);
        }

        // Filter by preferred date range
        if ($request->has('preferred_from_date') && $request->has('preferred_to_date')) {
            $query->whereBetween('preferred_date', [$request->preferred_from_date, $request->preferred_to_date]);
        }

        $certificates = $query->orderBy('created_at', 'desc')
                              ->paginate($request->per_page ?? 15);

        return response()->json([
            'success' => true,
            'data' => $certificates,
        ]);
    }

    /**
     * Store a newly created certificate form.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            // ✅ Use service_id instead of certificate_type
            'service_id' => 'required|exists:church_services,service_id',
            'full_name' => 'required|string|max:100',
            'address' => 'required|string',
            'contact_number' => 'required|string|max:20',
            'birth_date' => 'nullable|date|before_or_equal:today',
            'marriage_date' => 'nullable|date|before_or_equal:today',
            'preferred_date' => 'required|date|after_or_equal:today',
            'preferred_time' => 'required|date_format:H:i',
        ]);

        // ✅ Get service to determine which certificate type
        $churchService = ChurchService::find($validated['service_id']);
        
        if (!$churchService) {
            return response()->json([
                'success' => false,
                'message' => 'Service not found. Please contact the parish office.'
            ], 404);
        }

        // ✅ Validate based on service type
        if ($churchService->service_type === 'Baptismal Certificate' && empty($validated['birth_date'])) {
            return response()->json([
                'success' => false,
                'message' => 'Birth date is required for baptismal certificate.',
            ], 422);
        }

        if ($churchService->service_type === 'Marriage Certificate' && empty($validated['marriage_date'])) {
            return response()->json([
                'success' => false,
                'message' => 'Marriage date is required for marriage certificate.',
            ], 422);
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

        // ✅ Create with service_id
        $certificate = CertificateForm::create([
            'service_id' => $validated['service_id'],
            'full_name' => $validated['full_name'],
            'address' => $validated['address'],
            'contact_number' => $validated['contact_number'],
            'birth_date' => $validated['birth_date'] ?? null,
            'marriage_date' => $validated['marriage_date'] ?? null,
            'preferred_date' => $validated['preferred_date'],
            'preferred_time' => $validated['preferred_time'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Certificate form created successfully.',
            'data' => $certificate->load(['request', 'request.service', 'churchService']),
        ], 201);
    }

    /**
     * Display the specified certificate form.
     */
    public function show(int $id)
    {
        try {
            $certificate = CertificateForm::with([
                'request',
                'request.service',
                'request.user',
                'request.processedBy',
                'request.assignedPriest',
                'churchService'
            ])->findOrFail($id);
            
            return response()->json([
                'success' => true,
                'data' => $certificate,
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Certificate form not found.',
            ], 404);
        }
    }

    /**
     * Update the specified certificate form.
     */
    public function update(Request $request, int $id)
    {
        try {
            $certificate = CertificateForm::findOrFail($id);

            $validated = $request->validate([
                'full_name' => 'sometimes|required|string|max:100',
                'address' => 'sometimes|required|string',
                'contact_number' => 'sometimes|required|string|max:20',
                'birth_date' => 'nullable|date|before_or_equal:today',
                'marriage_date' => 'nullable|date|before_or_equal:today',
                'preferred_date' => 'sometimes|required|date|after_or_equal:today',
                'preferred_time' => 'sometimes|required|date_format:H:i',
            ]);

            $certificate->update($validated);

            return response()->json([
                'success' => true,
                'message' => 'Certificate form updated successfully.',
                'data' => $certificate->load(['request', 'request.service', 'churchService']),
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Certificate form not found.',
            ], 404);
        }
    }

    /**
     * Remove the specified certificate form.
     */
    public function destroy(int $id)
    {
        try {
            $certificate = CertificateForm::findOrFail($id);
            
            if ($certificate->request) {
                $certificate->request->delete();
            }
            
            $certificate->delete();

            return response()->json([
                'success' => true,
                'message' => 'Certificate form deleted successfully.',
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Certificate form not found.',
            ], 404);
        }
    }

    /**
     * Get certificate statistics.
     */
    public function statistics()
    {
        $total = CertificateForm::count();
        
        // ✅ Use service_id relationships
        $baptismal = CertificateForm::whereHas('churchService', function($q) {
            $q->where('service_type', 'Baptismal Certificate');
        })->count();
        
        $marriage = CertificateForm::whereHas('churchService', function($q) {
            $q->where('service_type', 'Marriage Certificate');
        })->count();
        
        $withRequests = CertificateForm::has('request')->count();
        $withoutRequests = CertificateForm::doesntHave('request')->count();

        $recent = CertificateForm::with(['request', 'request.service', 'churchService'])
                                ->orderBy('created_at', 'desc')
                                ->limit(5)
                                ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'total_certificates' => $total,
                'baptismal_certificates' => $baptismal,
                'marriage_certificates' => $marriage,
                'with_requests' => $withRequests,
                'without_requests' => $withoutRequests,
                'recent_requests' => $recent,
            ],
        ]);
    }

    /**
     * Get certificates by type.
     */
    public function getByType(string $type)
    {
        $validTypes = ['Baptismal Certificate', 'Marriage Certificate'];
        
        if (!in_array($type, $validTypes)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid certificate type. Must be Baptismal Certificate or Marriage Certificate.',
            ], 422);
        }

        $certificates = CertificateForm::with(['request', 'request.service', 'churchService'])
                                      ->whereHas('churchService', function($q) use ($type) {
                                          $q->where('service_type', $type);
                                      })
                                      ->orderBy('created_at', 'desc')
                                      ->paginate(15);

        return response()->json([
            'success' => true,
            'data' => $certificates,
        ]);
    }

    /**
     * Search certificate forms.
     */
    public function search(Request $request)
    {
        $request->validate([
            'query' => 'required|string|min:2'
        ]);
        
        $query = $request->query;
        
        $certificates = CertificateForm::with(['request', 'request.service', 'churchService'])
            ->where('full_name', 'LIKE', "%{$query}%")
            ->orWhere('contact_number', 'LIKE', "%{$query}%")
            ->orWhere('address', 'LIKE', "%{$query}%")
            ->orWhereHas('churchService', function($q) use ($query) {
                $q->where('service_type', 'LIKE', "%{$query}%");
            })
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get();
            
        return response()->json([
            'success' => true,
            'data' => $certificates
        ]);
    }

    /**
     * Get certificate forms by preferred date range.
     */
    public function getByPreferredDate(Request $request)
    {
        $request->validate([
            'from_date' => 'required|date',
            'to_date' => 'required|date|after_or_equal:from_date',
        ]);

        $certificates = CertificateForm::with(['request', 'request.service', 'churchService'])
                                       ->whereBetween('preferred_date', [$request->from_date, $request->to_date])
                                       ->orderBy('preferred_date', 'asc')
                                       ->orderBy('preferred_time', 'asc')
                                       ->paginate($request->per_page ?? 15);

        return response()->json([
            'success' => true,
            'data' => $certificates,
        ]);
    }

    /**
     * Get upcoming certificate forms.
     */
    public function getUpcoming()
    {
        $today = now()->toDateString();
        
        $certificates = CertificateForm::with(['request', 'request.service', 'churchService'])
                                       ->where('preferred_date', '>=', $today)
                                       ->orderBy('preferred_date', 'asc')
                                       ->orderBy('preferred_time', 'asc')
                                       ->paginate(15);

        return response()->json([
            'success' => true,
            'data' => $certificates,
        ]);
    }
}