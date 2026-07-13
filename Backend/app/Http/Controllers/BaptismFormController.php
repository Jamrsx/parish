<?php

namespace App\Http\Controllers;

use App\Models\BaptismForm;
use App\Models\Godparent;
use App\Models\ChurchService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class BaptismFormController extends Controller
{
    /**
     * Display a listing of the baptism requests.
     */
    public function index(Request $request)
    {
        $query = BaptismForm::with(['request', 'godparents']);

        // Filter by search term
        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('child_first_name', 'LIKE', "%{$search}%")
                    ->orWhere('child_last_name', 'LIKE', "%{$search}%")
                    ->orWhere('contact_number', 'LIKE', "%{$search}%");
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

        $baptismForms = $query->orderBy('created_at', 'desc')
            ->paginate($request->per_page ?? 15);

        return response()->json([
            'success' => true,
            'data' => $baptismForms,
        ]);
    }

    /**
     * Store a newly created baptism request in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'child_first_name' => 'required|string|max:50',
            'child_last_name' => 'required|string|max:50',
            'child_middle_name' => 'nullable|string|max:50',
            'child_birth_date' => 'required|date|before:today',
            'child_birth_place' => 'nullable|string|max:100',
            'mother_first_name' => 'required|string|max:50',
            'mother_last_name' => 'required|string|max:50',
            'mother_middle_name' => 'nullable|string|max:50',
            'father_first_name' => 'required|string|max:50',
            'father_last_name' => 'required|string|max:50',
            'father_middle_name' => 'nullable|string|max:50',
            'address' => 'required|string',
            'contact_number' => 'required|string|max:20',
            'preferred_date' => 'required|date|after_or_equal:today',
            'preferred_time' => 'required|date_format:H:i',
        ]);

        //AVAILABILITY CHECK
        $churchService = ChurchService::where('service_type', 'Baptism')->first();

        if (!$churchService) {
            return response()->json([
                'success' => false,
                'message' => 'Baptism service not configured. Please contact the parish office.'
            ], 404);
        }

        $preferredDate = Carbon::parse($validated['preferred_date']);

        // Check if date has available slots
        if (!$churchService->isAvailable($preferredDate)) {
            $nextAvailable = $churchService->findNextAvailableDate($preferredDate);

            return response()->json([
                'success' => false,
                'message' => 'No available slots for the selected date.',
                'data' => [
                    'next_available_date' => $nextAvailable,
                    'remaining_slots' => $churchService->getRemainingSlots($preferredDate),
                    'daily_limit' => $churchService->getDailyLimit(),
                ]
            ], 422);
        }

        // Check if time slot is available
        $existingBookings = $churchService->requests()
            ->whereDate('preferred_date', $validated['preferred_date'])
            ->where('preferred_time', $validated['preferred_time'])
            ->whereIn('status', ['pending', 'approved'])
            ->count();

        if ($existingBookings > 0) {
            return response()->json([
                'success' => false,
                'message' => 'The selected time slot is already booked. Please choose another time.'
            ], 422);
        }

        //DATABASE TRANSACTION
        DB::beginTransaction();

        try {
            $baptismForm = BaptismForm::create($validated);

            if ($request->has('godparents') && !empty($request->godparents)) {
                foreach ($request->godparents as $godparentData) {
                    $baptismForm->godparents()->create($godparentData);
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Baptism form created successfully.',
                'data' => $baptismForm->load(['request', 'godparents']),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'success' => false,
                'message' => 'Failed to create baptism form: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified baptism request.
     */
    public function show(int $id)
    {
        try {
            $baptismForm = BaptismForm::with(['request', 'godparents'])->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $baptismForm,
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Baptism form not found.',
            ], 404);
        }
    }

    /**
     * Update the specified baptism request in storage.
     */
    public function update(Request $request, int $id)
    {
        try {
            $baptismForm = BaptismForm::findOrFail($id);

            $validated = $request->validate([
                'child_first_name' => 'sometimes|required|string|max:50',
                'child_last_name' => 'sometimes|required|string|max:50',
                'child_middle_name' => 'nullable|string|max:50',
                'child_birth_date' => 'sometimes|required|date|before:today',
                'child_birth_place' => 'nullable|string|max:100',
                'mother_first_name' => 'sometimes|required|string|max:50',
                'mother_last_name' => 'sometimes|required|string|max:50',
                'mother_middle_name' => 'nullable|string|max:50',
                'father_first_name' => 'sometimes|required|string|max:50',
                'father_last_name' => 'sometimes|required|string|max:50',
                'father_middle_name' => 'nullable|string|max:50',
                'address' => 'sometimes|required|string',
                'contact_number' => 'sometimes|required|string|max:20',
                'preferred_date' => 'sometimes|required|date|after_or_equal:today',
                'preferred_time' => 'sometimes|required|date_format:H:i',
            ]);

            $baptismForm->update($validated);

            return response()->json([
                'success' => true,
                'message' => 'Baptism form updated successfully.',
                'data' => $baptismForm->load(['request', 'godparents']),
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Baptism form not found.',
            ], 404);
        }
    }

    /**
     * Remove the specified baptism request from storage.
     */
    public function destroy(int $id)
    {
        try {
            $baptismForm = BaptismForm::findOrFail($id);

            // Check if there's a request linked to this form
            if ($baptismForm->request) {
                $baptismForm->request->delete();
            }

            $baptismForm->delete();

            return response()->json([
                'success' => true,
                'message' => 'Baptism form deleted successfully.',
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Baptism form not found.',
            ], 404);
        }
    }

    /**
     * Get all godparents for a specific baptism request.
     */
    public function getGodparents(int $id)
    {
        try {
            $baptismForm = BaptismForm::with(['godparents'])->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $baptismForm->godparents,
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Baptism form not found.',
            ], 404);
        }
    }

    /**
     * Add a godparent to a baptism request.
     */
    public function addGodparent(Request $request, int $id)
    {
        try {
            $baptismForm = BaptismForm::findOrFail($id);

            $validated = $request->validate([
                'godparent_name' => 'required|string|max:100',
                'relationship' => 'required|in:godfather,godmother',
            ]);

            // Check if this godparent already exists
            $exists = Godparent::where('baptism_id', $id)
                ->where('godparent_name', $validated['godparent_name'])
                ->exists();

            if ($exists) {
                return response()->json([
                    'success' => false,
                    'message' => 'This godparent is already added to the baptism request.',
                ], 409);
            }

            $godparent = $baptismForm->godparents()->create($validated);

            return response()->json([
                'success' => true,
                'message' => 'Godparent added successfully.',
                'data' => $godparent,
            ], 201);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Baptism form not found.',
            ], 404);
        }
    }

    /**
     * Remove a godparent from a baptism request.
     */
    public function removeGodparent(int $baptismId, int $godparentId)
    {
        try {
            $baptismForm = BaptismForm::findOrFail($baptismId);
            $godparent = $baptismForm->godparents()->findOrFail($godparentId);
            $godparent->delete();

            return response()->json([
                'success' => true,
                'message' => 'Godparent removed successfully.',
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Baptism form or godparent not found.',
            ], 404);
        }
    }

    /**
     * Bulk add multiple godparents to a baptism request.
     */
    public function bulkAddGodparents(Request $request, int $id)
    {
        try {
            $baptismForm = BaptismForm::findOrFail($id);

            $validated = $request->validate([
                'godparents' => 'required|array|min:1',
                'godparents.*.godparent_name' => 'required|string|max:100',
                'godparents.*.relationship' => 'required|in:godfather,godmother',
            ]);

            $created = [];
            foreach ($validated['godparents'] as $godparentData) {
                $created[] = $baptismForm->godparents()->create([
                    'godparent_name' => $godparentData['godparent_name'],
                    'relationship' => $godparentData['relationship'],
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => count($created) . ' godparents added successfully.',
                'data' => $created,
            ], 201);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Baptism form not found.',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to add godparents: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get baptism statistics.
     */
    public function statistics()
    {
        $total = BaptismForm::count();
        $withRequests = BaptismForm::has('request')->count();
        $withoutRequests = BaptismForm::doesntHave('request')->count();
        $recent = BaptismForm::with(['request', 'godparents'])
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'total_baptism_forms' => $total,
                'with_requests' => $withRequests,
                'without_requests' => $withoutRequests,
                'recent_requests' => $recent,
            ],
        ]);
    }

    /**
     * Get baptism requests by child name.
     */
    public function searchByName(Request $request)
    {
        $request->validate([
            'name' => 'required|string|min:2',
        ]);

        $baptismForms = BaptismForm::with(['request', 'godparents'])
            ->where('child_first_name', 'LIKE', "%{$request->name}%")
            ->orWhere('child_last_name', 'LIKE', "%{$request->name}%")
            ->paginate($request->per_page ?? 15);

        return response()->json([
            'success' => true,
            'data' => $baptismForms,
        ]);
    }

    /**
     * Get baptism requests by contact number.
     */
    public function searchByContact(Request $request)
    {
        $request->validate([
            'contact' => 'required|string|min:2',
        ]);

        $baptismForms = BaptismForm::with(['request', 'godparents'])
            ->where('contact_number', 'LIKE', "%{$request->contact}%")
            ->paginate($request->per_page ?? 15);

        return response()->json([
            'success' => true,
            'data' => $baptismForms,
        ]);
    }

    /**
     * Get baptism forms by preferred date range.
     */
    public function getByPreferredDate(Request $request)
    {
        $request->validate([
            'from_date' => 'required|date',
            'to_date' => 'required|date|after_or_equal:from_date',
        ]);

        $baptismForms = BaptismForm::with(['request', 'godparents'])
            ->whereBetween('preferred_date', [$request->from_date, $request->to_date])
            ->orderBy('preferred_date', 'asc')
            ->orderBy('preferred_time', 'asc')
            ->paginate($request->per_page ?? 15);

        return response()->json([
            'success' => true,
            'data' => $baptismForms,
        ]);
    }

    /**
     * Get upcoming baptism forms.
     */
    public function getUpcoming()
    {
        $today = now()->toDateString();

        $baptismForms = BaptismForm::with(['request', 'godparents'])
            ->where('preferred_date', '>=', $today)
            ->orderBy('preferred_date', 'asc')
            ->orderBy('preferred_time', 'asc')
            ->paginate(15);

        return response()->json([
            'success' => true,
            'data' => $baptismForms,
        ]);
    }
}
