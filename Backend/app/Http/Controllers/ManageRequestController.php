<?php

namespace App\Http\Controllers;

use App\Models\ManageRequest;
use App\Models\BaptismForm;
use App\Models\ServiceForm;
use App\Models\CertificateForm;
use App\Models\ChurchService;
use App\Models\User;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class ManageRequestController extends Controller
{
    /**
     * Display a listing of the requests
     */
    public function index(Request $request)
    {
        $query = ManageRequest::with([
            'user',
            'service',
            'baptismForm.godparents',
            'baptismForm',
            'serviceForm',
            'certificateForm',
            'processedBy',
            'assignedPriest',
            'rescheduledBy'
        ]);

        // Filter by status
        if ($request->has('status') && $request->status !== 'all' && $request->status !== '') {
            $query->where('status', $request->status);
        }

        // Filter by payment status
        if ($request->has('payment_status') && $request->payment_status !== 'all' && $request->payment_status !== '') {
            $query->where('payment_status', $request->payment_status);
        }

        // Filter by form type
        if ($request->has('form_type') && $request->form_type !== 'all' && $request->form_type !== '') {
            if ($request->form_type === 'baptism') {
                $query->whereNotNull('baptism_form_id');
            } elseif ($request->form_type === 'service') {
                $query->whereNotNull('service_form_id');
            } elseif ($request->form_type === 'certificate') {
                $query->whereNotNull('certificate_form_id');
            }
        }

        // Filter by date range (using manage_requests preferred_date)
        if ($request->has('date_from')) {
            $query->whereDate('preferred_date', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->whereDate('preferred_date', '<=', $request->date_to);
        }

        // Search
        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->whereHas('user', function ($subQ) use ($search) {
                    $subQ->where('first_name', 'LIKE', "%{$search}%")
                        ->orWhere('last_name', 'LIKE', "%{$search}%")
                        ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$search}%"]);
                })->orWhere('request_id', 'LIKE', "%{$search}%")
                    ->orWhereHas('service', function ($subQ) use ($search) {
                        $subQ->where('service_type', 'LIKE', "%{$search}%");
                    });
            });
        }

        $perPage = $request->input('per_page', 15);
        $requests = $query->orderBy('created_at', 'desc')->paginate($perPage);

        // Transform the data to include computed attributes
        $requests->getCollection()->transform(function ($request) {
            return $this->transformRequest($request);
        });

        return response()->json([
            'success' => true,
            'data' => $requests
        ]);
    }

    /**
     * Transform a request with computed attributes
     */
    private function transformRequest($request)
    {
        return [
            'request_id' => $request->request_id,
            'user_id' => $request->user_id,
            'service_id' => $request->service_id,
            'processed_by' => $request->processed_by,
            'assigned_priest' => $request->assigned_priest,
            'baptism_form_id' => $request->baptism_form_id,
            'service_form_id' => $request->service_form_id,
            'certificate_form_id' => $request->certificate_form_id,
            'preferred_date' => $request->preferred_date,
            'preferred_time' => $request->preferred_time,
            'status' => $request->status,
            'cancelled_by' => $request->cancelled_by,
            'cancelled_reason' => $request->cancelled_reason,
            'payment_status' => $request->payment_status,
            'amount_paid' => (float) $request->amount_paid,
            'payment_date' => $request->payment_date,
            'approved_at' => $request->approved_at,
            'completed_at' => $request->completed_at,
            'created_at' => $request->created_at,
            'updated_at' => $request->updated_at,

            'can_be_rescheduled' => $request->can_be_rescheduled,
            'rescheduled_by' => $request->rescheduled_by,
            'rescheduledBy' => $request->rescheduledBy ? [
                'user_id' => $request->rescheduledBy->user_id,
                'first_name' => $request->rescheduledBy->first_name,
                'middle_name' => $request->rescheduledBy->middle_name,
                'last_name' => $request->rescheduledBy->last_name,
                'full_name' => $request->rescheduledBy->full_name,
                'email' => $request->rescheduledBy->email,
                'role' => $request->rescheduledBy->role,
            ] : null,
            'reschedule_reason' => $request->reschedule_reason,
            'reschedule_count' => $request->reschedule_count,

            'user' => $request->user ? [
                'user_id' => $request->user->user_id,
                'first_name' => $request->user->first_name,
                'middle_name' => $request->user->middle_name,
                'last_name' => $request->user->last_name,
                'full_name' => $request->user->full_name,
                'contact_number' => $request->user->contact_number,
                'email' => $request->user->email,
                'address' => $request->user->address,
                'role' => $request->user->role,
            ] : null,

            'service' => $request->service ? [
                'service_id' => $request->service->service_id,
                'service_type' => $request->service->service_type,
                'fee' => (float) $request->service->fee,
                'form_type' => $request->service->form_type,
            ] : null,

            'baptismForm' => $request->baptismForm,
            'serviceForm' => $request->serviceForm,
            'certificateForm' => $request->certificateForm,
            'processedBy' => $request->processedBy,
            'assignedPriest' => $request->assignedPriest,
            'cancelledBy' => $request->cancelledBy,

            'form_type' => $request->form_type,
            'form_type_label' => $request->form_type_label,
            'form_summary' => $request->form_summary,
            'status_color' => $request->status_color,
            'payment_status_color' => $request->payment_status_color,
            'remaining_balance' => (float) $request->remaining_balance,
            'is_fully_paid' => $request->is_fully_paid,
            'formatted_preferred_date' => $request->preferred_date ? date('F d, Y', strtotime($request->preferred_date)) : null,
            'formatted_preferred_time' => $request->preferred_time ? date('h:i A', strtotime($request->preferred_time)) : null,
        ];
    }

    /**
     * Store a newly created request 
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,user_id',
            'service_id' => 'required|exists:church_services,service_id',
            'baptism_form_id' => 'nullable|exists:baptism_forms,baptism_id',
            'service_form_id' => 'nullable|exists:service_forms,serviceform_id',
            'certificate_form_id' => 'nullable|exists:certificate_forms,certificate_id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        // Ensure at least one form is linked
        if (!$request->baptism_form_id && !$request->service_form_id && !$request->certificate_form_id) {
            return response()->json([
                'success' => false,
                'message' => 'At least one form must be linked to the request.'
            ], 422);
        }

        // Get preferred date/time from the associated form
        $preferredDate = null;
        $preferredTime = null;

        if ($request->baptism_form_id) {
            $form = BaptismForm::find($request->baptism_form_id);
            if ($form) {
                $preferredDate = $form->preferred_date;
                $preferredTime = $form->preferred_time;
            }
        } elseif ($request->service_form_id) {
            $form = ServiceForm::find($request->service_form_id);
            if ($form) {
                $preferredDate = $form->preferred_date;
                $preferredTime = $form->preferred_time;
            }
        } elseif ($request->certificate_form_id) {
            $form = CertificateForm::find($request->certificate_form_id);
            if ($form) {
                $preferredDate = $form->preferred_date;
                $preferredTime = $form->preferred_time;
            }
        }

        // Validate that the form has preferred date/time
        if (!$preferredDate || !$preferredTime) {
            return response()->json([
                'success' => false,
                'message' => 'The associated form does not have a preferred date and time set.'
            ], 422);
        }

        DB::beginTransaction();

        try {
            // Create the request with preferred date/time from the form
            $manageRequest = ManageRequest::create([
                'user_id' => $request->user_id,
                'service_id' => $request->service_id,
                'preferred_date' => $preferredDate,
                'preferred_time' => $preferredTime,
                'baptism_form_id' => $request->baptism_form_id,
                'service_form_id' => $request->service_form_id,
                'certificate_form_id' => $request->certificate_form_id,
                'status' => 'pending',
                'payment_status' => 'unpaid',
                'amount_paid' => 0,
            ]);

            // Create notification for new request
            try {
                $manageRequest->createNewRequestNotification();
            } catch (\Exception $e) {
                Log::error('Failed to create notification: ' . $e->getMessage());
                // Continue even if notification fails
            }

            DB::commit();

            $expiryMinutes = ManageRequest::expiryMinutes();

            return response()->json([
                'success' => true,
                'message' => 'Request created successfully!',
                'data' => array_merge(
                    $this->transformRequest($manageRequest->load([
                        'user',
                        'service',
                        'baptismForm',
                        'serviceForm',
                        'certificateForm'
                    ])),
                    [
                        'expires_at' => $manageRequest->created_at
                            ->copy()
                            ->addMinutes($expiryMinutes)
                            ->toIso8601String(),
                        'expiry_minutes' => $expiryMinutes,
                    ]
                )
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'success' => false,
                'message' => 'Failed to create request: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified request 
     */
    public function show($id)
    {
        try {
            $request = ManageRequest::with([
                'user',
                'service',
                'baptismForm.godparents',
                'baptismForm',
                'serviceForm',
                'certificateForm',
                'processedBy',
                'assignedPriest',
                'cancelledBy',
                'rescheduledBy'
            ])->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $this->transformRequest($request)
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Request not found.'
            ], 404);
        }
    }

    /**
     * Update the specified request 
     */
    public function update(Request $request, $id)
    {
        try {
            $manageRequest = ManageRequest::findOrFail($id);

            // Only pending requests can be updated
            if ($manageRequest->status !== 'pending') {
                return response()->json([
                    'success' => false,
                    'message' => 'Only pending requests can be updated.'
                ], 403);
            }

            $validator = Validator::make($request->all(), [
                'user_id' => 'sometimes|required|exists:users,user_id',
                'service_id' => 'sometimes|required|exists:church_services,service_id',
                'assigned_priest' => 'nullable|exists:users,user_id',
                'baptism_form_id' => 'nullable|exists:baptism_forms,baptism_id',
                'service_form_id' => 'nullable|exists:service_forms,serviceform_id',
                'certificate_form_id' => 'nullable|exists:certificate_forms,certificate_id',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            $updateData = $request->only([
                'user_id',
                'service_id',
                'assigned_priest',
                'baptism_form_id',
                'service_form_id',
                'certificate_form_id',
            ]);

            // If form is changed, update preferred date/time from the new form
            if ($request->has('baptism_form_id') || $request->has('service_form_id') || $request->has('certificate_form_id')) {
                $preferredDate = null;
                $preferredTime = null;

                if ($request->has('baptism_form_id') && $request->baptism_form_id) {
                    $form = BaptismForm::find($request->baptism_form_id);
                    if ($form) {
                        $preferredDate = $form->preferred_date;
                        $preferredTime = $form->preferred_time;
                    }
                } elseif ($request->has('service_form_id') && $request->service_form_id) {
                    $form = ServiceForm::find($request->service_form_id);
                    if ($form) {
                        $preferredDate = $form->preferred_date;
                        $preferredTime = $form->preferred_time;
                    }
                } elseif ($request->has('certificate_form_id') && $request->certificate_form_id) {
                    $form = CertificateForm::find($request->certificate_form_id);
                    if ($form) {
                        $preferredDate = $form->preferred_date;
                        $preferredTime = $form->preferred_time;
                    }
                }

                if ($preferredDate && $preferredTime) {
                    $updateData['preferred_date'] = $preferredDate;
                    $updateData['preferred_time'] = $preferredTime;
                }
            }

            $manageRequest->update($updateData);

            return response()->json([
                'success' => true,
                'message' => 'Request updated successfully!',
                'data' => $this->transformRequest($manageRequest->fresh([
                    'user',
                    'service',
                    'baptismForm',
                    'serviceForm',
                    'certificateForm'
                ]))
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Request not found.'
            ], 404);
        }
    }

    /**
     * Approve the request 
     */
    public function approve($id)
    {
        try {
            $manageRequest = ManageRequest::findOrFail($id);

            /** @var User|null $user */
            $user = auth('sanctum')->user();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthenticated.'
                ], 401);
            }

            if (!$user->isAdmin()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized. Admin authentication required.'
                ], 401);
            }

            // Store old status before updating
            $oldStatus = $manageRequest->status;

            if (!$manageRequest->approve($user)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Request cannot be approved. Only pending requests can be approved.'
                ], 422);
            }

            // Create notification for status change
            try {
                $manageRequest->createStatusNotification($oldStatus);
            } catch (\Exception $e) {
                Log::error('Failed to create notification: ' . $e->getMessage());
                // Continue even if notification fails
            }

            return response()->json([
                'success' => true,
                'message' => 'Request approved successfully!',
                'data' => $this->transformRequest($manageRequest->fresh([
                    'user',
                    'service',
                    'processedBy'
                ]))
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Request not found.'
            ], 404);
        }
    }

    /**
     * Complete the request 
     */
    public function complete($id)
    {
        try {
            $manageRequest = ManageRequest::findOrFail($id);

            // Store old status before updating
            $oldStatus = $manageRequest->status;

            if (!$manageRequest->complete()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Request cannot be completed. Only approved requests can be completed.'
                ], 422);
            }

            // Create notification for status change
            try {
                $manageRequest->createStatusNotification($oldStatus);
            } catch (\Exception $e) {
                Log::error('Failed to create notification: ' . $e->getMessage());
            }

            return response()->json([
                'success' => true,
                'message' => 'Request completed successfully!',
                'data' => $this->transformRequest($manageRequest->fresh([
                    'user',
                    'service'
                ]))
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Request not found.'
            ], 404);
        }
    }

    /**
     * Cancel the request 
     */
    public function cancel(Request $request, $id)
    {
        try {
            $manageRequest = ManageRequest::findOrFail($id);

            $validator = Validator::make($request->all(), [
                'cancelled_reason' => 'required|string|min:10|max:500',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            /** @var User|null $user */
            $user = auth('sanctum')->user();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthenticated.'
                ], 401);
            }

            if (!$user->isAdmin()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Only admins can cancel requests.'
                ], 403);
            }

            // Store old status before updating
            $oldStatus = $manageRequest->status;

            if (!$manageRequest->cancel($request->cancelled_reason, $user)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Request cannot be cancelled.'
                ], 422);
            }

            // Create notification for status change
            try {
                $manageRequest->createStatusNotification($oldStatus);
            } catch (\Exception $e) {
                Log::error('Failed to create notification: ' . $e->getMessage());
            }

            return response()->json([
                'success' => true,
                'message' => 'Request cancelled successfully!',
                'data' => $this->transformRequest($manageRequest->fresh([
                    'user',
                    'service'
                ]))
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Request not found.'
            ], 404);
        }
    }

    /**
     * Record payment for the request 
     */
    public function pay(Request $request, $id)
    {
        try {
            $manageRequest = ManageRequest::findOrFail($id);

            $validator = Validator::make($request->all(), [
                'amount' => 'required|numeric|min:0.01',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            // Check if amount exceeds remaining balance
            if ($request->amount > $manageRequest->remaining_balance) {
                return response()->json([
                    'success' => false,
                    'message' => 'Amount exceeds remaining balance.'
                ], 422);
            }

            $manageRequest->recordPayment($request->amount);

            $message = $manageRequest->is_fully_paid ?
                'Payment completed! Request is now fully paid.' :
                'Payment recorded successfully.';

            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => $this->transformRequest($manageRequest->fresh([
                    'user',
                    'service'
                ]))
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Request not found.'
            ], 404);
        }
    }

    /**
     * Remove the specified request 
     */
    public function destroy($id)
    {
        try {
            $manageRequest = ManageRequest::findOrFail($id);

            // Only pending or cancelled requests can be deleted
            if (!in_array($manageRequest->status, ['pending', 'cancelled'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Only pending or cancelled requests can be deleted.'
                ], 403);
            }

            $manageRequest->delete();

            return response()->json([
                'success' => true,
                'message' => 'Request deleted successfully!'
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Request not found.'
            ], 404);
        }
    }

    /**
     * Get form details for AJAX request 
     */
    public function getFormDetails(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'form_type' => 'required|in:baptism,service,certificate',
            'form_id' => 'required|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $form = null;
        $formTypeLabel = '';

        if ($request->form_type === 'baptism') {
            $form = BaptismForm::with('request')->find($request->form_id);
            $formTypeLabel = 'Baptism';
        } elseif ($request->form_type === 'service') {
            $form = ServiceForm::with('request')->find($request->form_id);
            $formTypeLabel = 'Service';
        } elseif ($request->form_type === 'certificate') {
            $form = CertificateForm::with('request')->find($request->form_id);
            $formTypeLabel = 'Certificate';
        }

        if (!$form) {
            return response()->json([
                'success' => false,
                'message' => 'Form not found'
            ], 404);
        }

        // Check if form already has a request
        if ($form->request) {
            return response()->json([
                'success' => false,
                'message' => 'This form already has a request associated with it.',
                'existing_request_id' => $form->request->request_id,
            ], 409);
        }

        return response()->json([
            'success' => true,
            'form' => $form,
            'form_type_label' => $formTypeLabel,
        ]);
    }

    /**
     * Export requests to CSV 
     */
    public function export(Request $request)
    {
        $query = ManageRequest::with(['user', 'service', 'baptismForm', 'serviceForm', 'certificateForm']);

        // Apply same filters as index
        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->has('form_type') && $request->form_type !== 'all') {
            if ($request->form_type === 'baptism') {
                $query->whereNotNull('baptism_form_id');
            } elseif ($request->form_type === 'service') {
                $query->whereNotNull('service_form_id');
            } elseif ($request->form_type === 'certificate') {
                $query->whereNotNull('certificate_form_id');
            }
        }

        $requests = $query->get();

        $filename = 'requests_' . date('Y-m-d') . '.csv';

        // Create CSV content
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"$filename\"",
        ];

        $callback = function () use ($requests) {
            $handle = fopen('php://output', 'w');

            // Add UTF-8 BOM for Excel compatibility
            fprintf($handle, chr(0xEF) . chr(0xBB) . chr(0xBF));

            // Add headers
            fputcsv($handle, [
                'Request ID',
                'User',
                'Service',
                'Form Type',
                'Form Details',
                'Preferred Date',
                'Preferred Time',
                'Status',
                'Payment Status',
                'Amount Paid',
                'Total Fee',
                'Remaining Balance',
                'Created At',
            ]);

            // Add data
            foreach ($requests as $request) {
                $formType = $request->form_type_label;
                $formDetails = $request->form_summary;

                fputcsv($handle, [
                    $request->request_id,
                    $request->user?->full_name ?? 'N/A',
                    $request->service?->service_type ?? 'N/A',
                    $formType,
                    $formDetails,
                    $request->preferred_date ? date('Y-m-d', strtotime($request->preferred_date)) : 'N/A',
                    $request->preferred_time ? date('h:i A', strtotime($request->preferred_time)) : 'N/A',
                    ucfirst($request->status),
                    ucfirst($request->payment_status),
                    number_format($request->amount_paid, 2),
                    number_format($request->service?->fee ?? 0, 2),
                    number_format($request->remaining_balance, 2),
                    $request->created_at->format('Y-m-d H:i:s'),
                ]);
            }

            fclose($handle);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * Reschedule a request (Admin or Parishioner)
     */
    public function reschedule(Request $request, $id)
    {
        try {
            $manageRequest = ManageRequest::with([
                'user',
                'service',
                'baptismForm',
                'serviceForm',
                'certificateForm',
                'rescheduledBy'
            ])->findOrFail($id);

            if (!$manageRequest->can_be_rescheduled) {
                return response()->json([
                    'success' => false,
                    'message' => 'This request cannot be rescheduled because it is already completed or cancelled.'
                ], 422);
            }

            $validator = Validator::make($request->all(), [
                'preferred_date' => 'required|date|after_or_equal:today',
                'preferred_time' => 'required|date_format:H:i',
                'reschedule_reason' => 'required|string|min:10|max:500',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            /** @var User|null $user */
            $user = auth('sanctum')->user();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthenticated.'
                ], 401);
            }

            $isAdmin = $user->isAdmin();
            $isParishioner = $user->isParishioner();

            if ($isParishioner) {
                if ($manageRequest->user_id !== $user->user_id) {
                    return response()->json([
                        'success' => false,
                        'message' => 'You can only reschedule your own requests.'
                    ], 403);
                }
            } elseif (!$isAdmin) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized. Only admins or the request owner can reschedule.'
                ], 401);
            }

            $oldDate = $manageRequest->preferred_date;
            $oldTime = $manageRequest->preferred_time;

            $service = $manageRequest->service;
            if ($service) {
                $scheduleError = $service->validateSchedule(
                    $request->preferred_date,
                    $request->preferred_time,
                    $manageRequest->request_id
                );

                if ($scheduleError) {
                    return response()->json([
                        'success' => false,
                        'message' => $scheduleError,
                    ], 422);
                }
            }

            $success = $manageRequest->reschedule([
                'preferred_date' => $request->preferred_date,
                'preferred_time' => $request->preferred_time,
                'reschedule_reason' => $request->reschedule_reason,
            ], $isAdmin ? $user : null);

            if (!$success) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to reschedule the request.'
                ], 500);
            }

            return response()->json([
                'success' => true,
                'message' => 'Request rescheduled successfully!',
                'data' => [
                    'request' => $this->transformRequest($manageRequest->fresh([
                        'user',
                        'service',
                        'baptismForm',
                        'serviceForm',
                        'certificateForm',
                        'rescheduledBy'
                    ])),
                    'reschedule_details' => [
                        'old_date' => $oldDate,
                        'old_time' => $oldTime,
                        'new_date' => $manageRequest->preferred_date,
                        'new_time' => $manageRequest->preferred_time,
                        'reason' => $request->reschedule_reason,
                        'rescheduled_by' => $isAdmin ? 'Admin' : 'Parishioner',
                    ]
                ]
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Request not found.'
            ], 404);
        }
    }

    /**
     * Assign a priest to a request
     */
    public function assignPriest(Request $request, $id)
    {
        try {
            $manageRequest = ManageRequest::findOrFail($id);

            $validator = Validator::make($request->all(), [
                'priest_id' => 'required|exists:users,user_id',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            /** @var User|null $user */
            $user = auth('sanctum')->user();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthenticated.'
                ], 401);
            }

            if (!$user->isAdmin()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized. Admin authentication required.'
                ], 401);
            }

            // Verify the user is actually a priest
            $priest = User::find($request->priest_id);
            if (!$priest || !$priest->isPriest()) {
                return response()->json([
                    'success' => false,
                    'message' => 'The selected user is not a priest.'
                ], 422);
            }

            // Update the request with the assigned priest
            $manageRequest->update([
                'assigned_priest' => $request->priest_id,
            ]);

            // Create notification for priest assignment
            try {
                $manageRequest->createPriestAssignmentNotification($priest);
            } catch (\Exception $e) {
                Log::error('Failed to create priest assignment notification: ' . $e->getMessage());
            }

            return response()->json([
                'success' => true,
                'message' => 'Priest assigned successfully!',
                'data' => $this->transformRequest($manageRequest->fresh([
                    'user',
                    'service',
                    'assignedPriest'
                ]))
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Request not found.'
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to assign priest: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all processed baptisms for admin
     */
    public function getProcessedBaptisms()
    {
        $baptisms = BaptismForm::with(['request', 'godparents'])
            ->whereHas('request', function ($q) {
                $q->whereIn('status', ['pending', 'approved', 'done', 'cancelled']);
            })
            ->get()
            ->map(function ($baptism) {
                return [
                    'id' => $baptism->baptism_id,
                    'service_type' => 'baptism',
                    'requester_name' => $baptism->father_first_name . ' ' . $baptism->father_last_name,
                    'preferred_date' => $baptism->preferred_date,
                    'preferred_time' => $baptism->preferred_time,
                    'contact_no' => $baptism->contact_number,
                    'status' => $baptism->request->status ?? 'pending',
                    'created_at' => $baptism->created_at,
                    'details' => [
                        'child_name' => $baptism->child_first_name . ' ' . $baptism->child_last_name,
                        'date_of_birth' => $baptism->child_birth_date,
                        'place_of_birth' => $baptism->child_birth_place,
                        'father_name' => $baptism->father_first_name . ' ' . $baptism->father_last_name,
                        'mother_name' => $baptism->mother_first_name . ' ' . $baptism->mother_last_name,
                        'address' => $baptism->address,
                        'contact_no' => $baptism->contact_number,
                        'baptism_date' => $baptism->preferred_date,
                        'godparents' => $baptism->godparents ?? []
                    ]
                ];
            });

        return response()->json([
            'success' => true,
            'data' => [
                'data' => $baptisms
            ]
        ], 200);
    }

    /**
     * Get baptism details with godparents
     */
    public function getBaptismDetails($id)
    {
        $baptism = BaptismForm::with(['request', 'godparents'])->find($id);

        if (!$baptism) {
            return response()->json([
                'success' => false,
                'message' => 'Baptism not found'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $baptism->baptism_id,
                'service_type' => 'baptism',
                'requester_name' => $baptism->father_first_name . ' ' . $baptism->father_last_name,
                'preferred_date' => $baptism->preferred_date,
                'contact_no' => $baptism->contact_number,
                'status' => $baptism->request->status ?? 'pending',
                'created_at' => $baptism->created_at,
                'details' => [
                    'child_name' => $baptism->child_first_name . ' ' . $baptism->child_last_name,
                    'date_of_birth' => $baptism->child_birth_date,
                    'place_of_birth' => $baptism->child_birth_place,
                    'father_name' => $baptism->father_first_name . ' ' . $baptism->father_last_name,
                    'mother_name' => $baptism->mother_first_name . ' ' . $baptism->mother_last_name,
                    'address' => $baptism->address,
                    'contact_no' => $baptism->contact_number,
                    'baptism_date' => $baptism->preferred_date,
                    'godparents' => $baptism->godparents ?? []
                ]
            ]
        ], 200);
    }

    /**
     * Update baptism status
     */
    public function updateBaptismStatus(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:pending,approved,done,cancelled'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $baptism = BaptismForm::find($id);

        if (!$baptism) {
            return response()->json([
                'success' => false,
                'message' => 'Baptism not found'
            ], 404);
        }

        if ($baptism->request) {
            $oldStatus = $baptism->request->status;
            $baptism->request->update(['status' => $request->status]);

            if ($baptism->request->user_id) {
                try {
                    $baptism->request->createStatusNotification($oldStatus);
                } catch (\Exception $e) {
                    Log::error('Failed to create notification: ' . $e->getMessage());
                }
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Baptism status updated successfully'
        ], 200);
    }

    /**
     * Get all processed funeral masses for admin
     */
    public function getProcessedFuneralMasses()
    {
        $funerals = ServiceForm::with(['request', 'churchService'])
            ->whereHas('churchService', function ($q) {
                $q->where('service_type', 'Funeral Mass');
            })
            ->whereHas('request', function ($q) {
                $q->whereIn('status', ['pending', 'approved', 'done', 'cancelled']);
            })
            ->get()
            ->map(function ($form) {
                return [
                    'id' => $form->serviceform_id,
                    'service_type' => 'funeral_mass',
                    'requester_name' => $form->full_name,
                    'preferred_date' => $form->preferred_date,
                    'preferred_time' => $form->preferred_time,
                    'contact_no' => $form->contact_number,
                    'status' => $form->request->status ?? 'pending',
                    'created_at' => $form->created_at,
                    'details' => [
                        'deceased_name' => $form->full_name,
                        'address' => $form->address,
                        'funeral_date' => $form->preferred_date,
                        'time' => $form->preferred_time,
                        'contact_no' => $form->contact_number
                    ]
                ];
            });

        return response()->json([
            'success' => true,
            'data' => [
                'data' => $funerals
            ]
        ], 200);
    }

    /**
     * Update funeral mass status
     */
    public function updateFuneralMassStatus(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:pending,approved,done,cancelled'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $form = ServiceForm::with('request')->find($id);

        if (!$form) {
            return response()->json([
                'success' => false,
                'message' => 'Funeral mass not found'
            ], 404);
        }

        if ($form->request) {
            $oldStatus = $form->request->status;
            $form->request->update(['status' => $request->status]);

            if ($form->request->user_id) {
                try {
                    $form->request->createStatusNotification($oldStatus);
                } catch (\Exception $e) {
                    Log::error('Failed to create notification: ' . $e->getMessage());
                }
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Funeral mass status updated successfully'
        ], 200);
    }

    /**
     * Get all house blessings for admin
     */
    public function getHouseBlessings()
    {
        $blessings = ServiceForm::with(['request', 'churchService'])
            ->whereHas('churchService', function ($q) {
                $q->where('service_type', 'House Blessing');
            })
            ->whereHas('request', function ($q) {
                $q->whereIn('status', ['pending', 'approved', 'done', 'cancelled']);
            })
            ->get()
            ->map(function ($form) {
                return [
                    'id' => $form->serviceform_id,
                    'service_type' => 'house_blessing',
                    'requester_name' => $form->full_name,
                    'preferred_date' => $form->preferred_date,
                    'preferred_time' => $form->preferred_time,
                    'contact_no' => $form->contact_number,
                    'status' => $form->request->status ?? 'pending',
                    'created_at' => $form->created_at,
                    'details' => [
                        'requester_name' => $form->full_name,
                        'address' => $form->address,
                        'contact_no' => $form->contact_number
                    ]
                ];
            });

        return response()->json([
            'success' => true,
            'data' => [
                'data' => $blessings
            ]
        ], 200);
    }

    /**
     * Update house blessing status
     */
    public function updateHouseBlessingStatus(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:pending,approved,done,cancelled'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $form = ServiceForm::with('request')->find($id);

        if (!$form) {
            return response()->json([
                'success' => false,
                'message' => 'House blessing not found'
            ], 404);
        }

        if ($form->request) {
            $oldStatus = $form->request->status;
            $form->request->update(['status' => $request->status]);

            if ($form->request->user_id) {
                try {
                    $form->request->createStatusNotification($oldStatus);
                } catch (\Exception $e) {
                    Log::error('Failed to create notification: ' . $e->getMessage());
                }
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'House blessing status updated successfully'
        ], 200);
    }

    /**
     * Get all processed marriages for admin
     */
    public function getProcessedMarriages()
    {
        $marriages = ServiceForm::with(['request', 'churchService'])
            ->whereHas('churchService', function ($q) {
                $q->where('service_type', 'Marriage');
            })
            ->whereHas('request', function ($q) {
                $q->whereIn('status', ['pending', 'approved', 'done', 'cancelled']);
            })
            ->get()
            ->map(function ($form) {
                return [
                    'id' => $form->serviceform_id,
                    'couple_names' => $form->full_name,
                    'address' => $form->address,
                    'contact_no' => $form->contact_number,
                    'preferred_date' => $form->preferred_date,
                    'preferred_time' => $form->preferred_time,
                    'status' => $form->request->status ?? 'pending',
                    'created_at' => $form->created_at,
                    'details' => [
                        'contact_no' => $form->contact_number
                    ]
                ];
            });

        return response()->json([
            'success' => true,
            'data' => [
                'data' => $marriages
            ]
        ], 200);
    }

    /**
     * Update marriage status
     */
    public function updateMarriageStatus(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:pending,approved,done,cancelled'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $form = ServiceForm::with('request')->find($id);

        if (!$form) {
            return response()->json([
                'success' => false,
                'message' => 'Marriage inquiry not found'
            ], 404);
        }

        if ($form->request) {
            $oldStatus = $form->request->status;
            $form->request->update(['status' => $request->status]);

            if ($form->request->user_id) {
                try {
                    $form->request->createStatusNotification($oldStatus);
                } catch (\Exception $e) {
                    Log::error('Failed to create notification: ' . $e->getMessage());
                }
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Marriage status updated successfully'
        ], 200);
    }

    // PARISHIONER METHODS

    /**
     * Expire pending requests for the authenticated parishioner (called by mobile after 2 min).
     */
    public function expirePendingRequests(Request $request)
    {
        /** @var User|null $user */
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.'
            ], 401);
        }

        if (!$user->isParishioner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only parishioners can expire their requests.'
            ], 403);
        }

        $expiredCount = ManageRequest::expirePendingRequests($user->user_id);

        return response()->json([
            'success' => true,
            'message' => $expiredCount > 0
                ? "{$expiredCount} request(s) expired and marked as cancelled."
                : 'No requests to expire.',
            'data' => [
                'expired_count' => $expiredCount,
                'expiry_minutes' => ManageRequest::expiryMinutes(),
            ],
        ]);
    }

    /**
     * Get requests for authenticated user (parishioner)
     */
    public function getUserRequests(Request $request)
    {
        /** @var User|null $user */
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.'
            ], 401);
        }

        if (!$user->isParishioner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only parishioners can access their requests.'
            ], 403);
        }

        ManageRequest::expirePendingRequests($user->user_id);

        $requests = ManageRequest::where('user_id', $user->user_id)
            ->with(['service', 'baptismForm', 'serviceForm', 'certificateForm', 'processedBy', 'assignedPriest'])
            ->orderBy('created_at', 'desc')
            ->paginate($request->per_page ?? 15);

        // Transform the data to include computed attributes
        $requests->getCollection()->transform(function ($request) {
            return $this->transformRequest($request);
        });

        return response()->json([
            'success' => true,
            'data' => $requests
        ]);
    }

    /**
     * Get statistics for authenticated user (parishioner)
     */
    public function getUserStatistics(Request $request)
    {
        /** @var User|null $user */
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.'
            ], 401);
        }

        if (!$user->isParishioner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only parishioners can access their statistics.'
            ], 403);
        }

        $requests = ManageRequest::where('user_id', $user->user_id)->get();

        return response()->json([
            'success' => true,
            'data' => [
                'total_requests' => $requests->count(),
                'pending' => $requests->where('status', 'pending')->count(),
                'approved' => $requests->where('status', 'approved')->count(),
                'completed' => $requests->where('status', 'done')->count(),
                'cancelled' => $requests->where('status', 'cancelled')->count(),
                'unpaid' => $requests->where('payment_status', 'unpaid')->count(),
                'partial' => $requests->where('payment_status', 'partial')->count(),
                'paid' => $requests->where('payment_status', 'paid')->count(),
            ]
        ]);
    }

    // PRIEST METHODS

    /**
     * Get assigned requests for priest
     */
    public function getAssignedRequests(Request $request)
    {
        /** @var User|null $user */
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.'
            ], 401);
        }

        if (!$user->isPriest()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only priests can access assigned requests.'
            ], 403);
        }

        $requests = ManageRequest::where('assigned_priest', $user->user_id)
            ->with(['user', 'service', 'baptismForm', 'serviceForm', 'certificateForm'])
            ->orderBy('created_at', 'desc')
            ->paginate($request->per_page ?? 15);

        // Transform the data to include computed attributes
        $requests->getCollection()->transform(function ($request) {
            return $this->transformRequest($request);
        });

        return response()->json([
            'success' => true,
            'data' => $requests
        ]);
    }

    /**
     * Update request status for priest
     */
    public function updateRequestStatus(Request $request, $id)
    {
        /** @var User|null $user */
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.'
            ], 401);
        }

        if (!$user->isPriest()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only priests can update request status.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|in:approved,completed,cancelled',
            'reason' => 'nullable|string|max:500'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $manageRequest = ManageRequest::findOrFail($id);

            // Verify this priest is assigned to the request
            if ($manageRequest->assigned_priest !== $user->user_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'You are not assigned to this request.'
                ], 403);
            }

            // Store old status for notification
            $oldStatus = $manageRequest->status;

            // Update status
            $manageRequest->update([
                'status' => $request->status
            ]);

            // Create notification for status change
            if ($manageRequest->user_id) {
                try {
                    $manageRequest->createStatusNotification($oldStatus);
                } catch (\Exception $e) {
                    Log::error('Failed to create notification: ' . $e->getMessage());
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Request status updated successfully',
                'data' => $this->transformRequest($manageRequest->fresh(['user', 'service']))
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Request not found'
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update request status: ' . $e->getMessage()
            ], 500);
        }
    }
}
