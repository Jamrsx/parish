<?php

namespace App\Http\Controllers;

use App\Models\Godparent;
use App\Models\BaptismForm;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class GodparentController extends Controller
{
    /**
     * Display a listing of godparents.
     */
    public function index(Request $request)
    {
        $query = Godparent::with('baptismForm');

        // Filter by baptism request
        if ($request->has('baptism_id')) {
            $query->where('baptism_id', $request->baptism_id);
        }

        // Filter by relationship
        if ($request->has('relationship') && in_array($request->relationship, ['godfather', 'godmother'])) {
            $query->where('relationship', $request->relationship);
        }

        $godparents = $query->orderBy('created_at', 'desc')
                            ->paginate($request->per_page ?? 15);

        return response()->json([
            'success' => true,
            'data' => $godparents,
        ]);
    }

    /**
     * Store a newly created godparent.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'baptism_id' => 'required|integer|exists:baptism_forms,baptism_id',
            'godparent_name' => 'required|string|max:100',
            'relationship' => ['required', Rule::in(['godfather', 'godmother'])],
        ]);

        // Check if baptism request exists
        $baptismForm = BaptismForm::find($validated['baptism_id']);
        if (!$baptismForm) {
            return response()->json([
                'success' => false,
                'message' => 'Baptism request not found.',
            ], 404);
        }

        // Check if this godparent already exists for this baptism
        $exists = Godparent::where('baptism_id', $validated['baptism_id'])
                          ->where('godparent_name', $validated['godparent_name'])
                          ->exists();
        
        if ($exists) {
            return response()->json([
                'success' => false,
                'message' => 'This godparent is already added to the baptism request.',
            ], 409);
        }

        $godparent = Godparent::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Godparent added successfully.',
            'data' => $godparent->load('baptismForm'),
        ], 201);
    }

    /**
     * Display the specified godparent.
     */
    public function show(int $id)
    {
        try {
            $godparent = Godparent::with('baptismForm')->findOrFail($id);
            
            return response()->json([
                'success' => true,
                'data' => $godparent,
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Godparent not found.',
            ], 404);
        }
    }

    /**
     * Update the specified godparent.
     */
    public function update(Request $request, int $id)
    {
        try {
            $godparent = Godparent::findOrFail($id);

            $validated = $request->validate([
                'godparent_name' => 'sometimes|required|string|max:100',
                'relationship' => ['sometimes', 'required', Rule::in(['godfather', 'godmother'])],
            ]);

            $godparent->update($validated);

            return response()->json([
                'success' => true,
                'message' => 'Godparent updated successfully.',
                'data' => $godparent->load('baptismForm'),
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Godparent not found.',
            ], 404);
        }
    }

    /**
     * Remove the specified godparent.
     */
    public function destroy(int $id)
    {
        try {
            $godparent = Godparent::findOrFail($id);
            $godparent->delete();

            return response()->json([
                'success' => true,
                'message' => 'Godparent deleted successfully.',
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Godparent not found.',
            ], 404);
        }
    }

    /**
     * Get godparents for a specific baptism request.
     */
    public function getByBaptismForm(int $baptismId)
    {
        $baptismForm = BaptismForm::find($baptismId);
        
        if (!$baptismForm) {
            return response()->json([
                'success' => false,
                'message' => 'Baptism request not found.',
            ], 404);
        }

        $godparents = Godparent::where('baptism_id', $baptismId)->get();

        return response()->json([
            'success' => true,
            'data' => [
                'godfathers' => $godparents->where('relationship', 'godfather')->values(),
                'godmothers' => $godparents->where('relationship', 'godmother')->values(),
                'total' => $godparents->count(),
            ],
        ]);
    }

    /**
     * Bulk add godparents for a baptism request.
     */
    public function bulkStore(Request $request)
    {
        $validated = $request->validate([
            'baptism_id' => 'required|integer|exists:baptism_forms,baptism_id',
            'godparents' => 'required|array|min:1',
            'godparents.*.godparent_name' => 'required|string|max:100',
            'godparents.*.relationship' => ['required', Rule::in(['godfather', 'godmother'])],
        ]);

        $baptismForm = BaptismForm::find($validated['baptism_id']);
        if (!$baptismForm) {
            return response()->json([
                'success' => false,
                'message' => 'Baptism request not found.',
            ], 404);
        }

        $created = [];
        foreach ($validated['godparents'] as $godparentData) {
            $godparentData['baptism_id'] = $validated['baptism_id'];
            $created[] = Godparent::create($godparentData);
        }

        return response()->json([
            'success' => true,
            'message' => count($created) . ' godparents added successfully.',
            'data' => $created,
        ], 201);
    }
}