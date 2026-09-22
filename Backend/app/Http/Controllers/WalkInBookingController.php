<?php

namespace App\Http\Controllers;

use App\Models\BaptismForm;
use App\Models\CertificateForm;
use App\Models\ChurchService;
use App\Models\Godparent;
use App\Models\ManageRequest;
use App\Models\ServiceForm;
use App\Models\SpecialIntention;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class WalkInBookingController extends Controller
{
    public function store(Request $request)
    {
        /** @var User $secretary */
        $secretary = $request->user();
        if (!$secretary || !$secretary->isSecretary()) {
            return response()->json([
                'success' => false,
                'message' => 'Only the secretary can create walk-in bookings.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'service_id' => 'required|exists:church_services,service_id',
            'first_name' => 'required|string|max:50',
            'middle_name' => 'nullable|string|max:50',
            'last_name' => 'required|string|max:50',
            'contact_number' => ['required', 'regex:/^09\d{9}$/'],
            'address' => 'nullable|string|max:500',
            'is_resident' => 'required|boolean',
            'preferred_date' => 'required|date|after_or_equal:today',
            'preferred_time' => 'required|date_format:H:i',
            'child_first_name' => 'nullable|string|max:50',
            'child_middle_name' => 'nullable|string|max:50',
            'child_last_name' => 'nullable|string|max:50',
            'child_birth_date' => 'nullable|date',
            'child_birth_place' => 'nullable|string|max:100',
            'mother_first_name' => 'nullable|string|max:50',
            'mother_middle_name' => 'nullable|string|max:50',
            'mother_last_name' => 'nullable|string|max:50',
            'father_first_name' => 'nullable|string|max:50',
            'father_middle_name' => 'nullable|string|max:50',
            'father_last_name' => 'nullable|string|max:50',
            'birth_date' => 'nullable|date',
            'baptism_date' => 'nullable|date',
            'marriage_date' => 'nullable|date',
            'intention_text' => 'nullable|string|min:5|max:1000',
            'godparents' => 'nullable|array',
            'godparents.*.godparent_name' => 'required_with:godparents|string|max:100',
            'godparents.*.relationship' => 'required_with:godparents|in:godfather,godmother',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first() ?: 'Please complete the walk-in form.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $churchService = ChurchService::find($request->service_id);
        if (!$churchService || !$churchService->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'That church service is not available.',
            ], 422);
        }

        $formType = $churchService->form_type;
        $isCertificate = $churchService->isCertificate();

        if ($formType === 'baptism') {
            $baptismCheck = Validator::make($request->all(), [
                'child_first_name' => 'required|string|max:50',
                'child_last_name' => 'required|string|max:50',
                'child_birth_date' => 'required|date',
                'mother_first_name' => 'required|string|max:50',
                'mother_last_name' => 'required|string|max:50',
                'father_first_name' => 'required|string|max:50',
                'father_last_name' => 'required|string|max:50',
            ]);
            if ($baptismCheck->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => $baptismCheck->errors()->first(),
                    'errors' => $baptismCheck->errors(),
                ], 422);
            }
        }

        if ($formType === 'certificate') {
            $handler = (string) $churchService->form_handler;
            $typeName = strtolower((string) $churchService->service_type);
            if ($handler === 'marriage_certificate' || str_contains($typeName, 'marriage')) {
                if (!$request->filled('marriage_date')) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Marriage date is required for a marriage certificate.',
                    ], 422);
                }
            } else {
                if (!$request->filled('birth_date')) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Birth date is required for a baptismal certificate.',
                    ], 422);
                }
                if (!$request->filled('baptism_date')) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Baptism date is required for a baptismal certificate.',
                    ], 422);
                }
            }
        }

        if ($formType === 'special_intention' && !$request->filled('intention_text')) {
            return response()->json([
                'success' => false,
                'message' => 'Intention text is required for a special intention.',
            ], 422);
        }

        $preferredDate = $request->preferred_date;
        $preferredTime = $request->preferred_time;

        if (!$isCertificate) {
            $quotaError = $churchService->validateTodaySubmissionQuota();
            if ($quotaError) {
                return response()->json([
                    'success' => false,
                    'message' => $quotaError,
                    'data' => [
                        'next_available_date' => $churchService->findNextAvailableDate(),
                        'remaining_slots' => $churchService->getRemainingSlots(),
                        'daily_limit' => $churchService->getDailyLimit(),
                    ],
                ], 422);
            }

            $scheduleError = ManageRequest::validateGlobalSchedule($preferredDate, $preferredTime);
            if ($scheduleError) {
                return response()->json([
                    'success' => false,
                    'message' => $scheduleError,
                ], 422);
            }
        }

        $rawResident = $request->input('is_resident');
        $isResident = !in_array($rawResident, [false, 0, '0', 'false', 'False', 'off', 'no'], true);
        if (!$isResident && !trim((string) $request->address)) {
            return response()->json([
                'success' => false,
                'message' => 'Address is required for a non-resident.',
            ], 422);
        }

        $formAddress = $isResident ? 'Parish resident' : trim((string) $request->address);
        $clientName = trim($request->first_name . ' ' . ($request->middle_name ? $request->middle_name . ' ' : '') . $request->last_name);

        DB::beginTransaction();
        try {
            $client = $this->resolveWalkInClient($request, $isResident, $formAddress);

            $baptismId = null;
            $serviceFormId = null;
            $certificateId = null;

            if ($formType === 'baptism') {
                $baptism = BaptismForm::create([
                    'child_first_name' => $request->child_first_name,
                    'child_middle_name' => $request->child_middle_name,
                    'child_last_name' => $request->child_last_name,
                    'child_birth_date' => $request->child_birth_date,
                    'child_birth_place' => $request->child_birth_place,
                    'mother_first_name' => $request->mother_first_name,
                    'mother_middle_name' => $request->mother_middle_name,
                    'mother_last_name' => $request->mother_last_name,
                    'father_first_name' => $request->father_first_name,
                    'father_middle_name' => $request->father_middle_name,
                    'father_last_name' => $request->father_last_name,
                    'address' => $formAddress,
                    'contact_number' => $request->contact_number,
                    'preferred_date' => $preferredDate,
                    'preferred_time' => $preferredTime,
                ]);
                $baptismId = $baptism->baptism_id;

                $godparents = $request->input('godparents', []);
                if (is_array($godparents)) {
                    foreach ($godparents as $gp) {
                        $name = trim((string) ($gp['godparent_name'] ?? ''));
                        $relationship = $gp['relationship'] ?? null;
                        if ($name === '' || !in_array($relationship, ['godfather', 'godmother'], true)) {
                            continue;
                        }
                        Godparent::create([
                            'baptism_id' => $baptismId,
                            'godparent_name' => $name,
                            'relationship' => $relationship,
                        ]);
                    }
                    Log::info('Walk-in baptism godparents saved', [
                        'baptism_id' => $baptismId,
                        'count' => count($godparents),
                    ]);
                }
            } elseif ($formType === 'certificate') {
                $certificate = CertificateForm::create([
                    'service_id' => $churchService->service_id,
                    'full_name' => $clientName,
                    'birth_date' => $request->birth_date,
                    'baptism_date' => $request->baptism_date,
                    'marriage_date' => $request->marriage_date,
                    'address' => $formAddress,
                    'contact_number' => $request->contact_number,
                    'preferred_date' => $preferredDate,
                    'preferred_time' => $preferredTime,
                ]);
                $certificateId = $certificate->certificate_id;
            } else {
                $serviceForm = ServiceForm::create([
                    'service_id' => $churchService->service_id,
                    'full_name' => $clientName,
                    'address' => $formAddress,
                    'contact_number' => $request->contact_number,
                    'preferred_date' => $preferredDate,
                    'preferred_time' => $preferredTime,
                ]);
                $serviceFormId = $serviceForm->serviceform_id;
            }

            $manageRequest = ManageRequest::create([
                'user_id' => $client->user_id,
                'service_id' => $churchService->service_id,
                'processed_by' => $secretary->user_id,
                'preferred_date' => $preferredDate,
                'preferred_time' => $preferredTime,
                'baptism_form_id' => $baptismId,
                'service_form_id' => $serviceFormId,
                'certificate_form_id' => $certificateId,
                'status' => 'approved',
                'is_resident' => $isResident,
                'payment_status' => 'unpaid',
                'amount_paid' => 0,
                'approved_at' => now(),
            ]);

            if ($formType === 'special_intention') {
                SpecialIntention::create([
                    'user_id' => $client->user_id,
                    'request_id' => $manageRequest->request_id,
                    'parishioner_name' => $clientName,
                    'intention_text' => $request->intention_text,
                    'amount' => (float) $churchService->fee,
                    'denomination_breakdown' => null,
                    'intention_date' => $preferredDate,
                    'notes' => 'Walk-in booking',
                    'source' => SpecialIntention::SOURCE_SECRETARY,
                    'recorded_by' => $secretary->user_id,
                    'status' => 'approved',
                ]);
            }

            try {
                $manageRequest->createNewRequestNotification();
            } catch (\Exception $e) {
                Log::error('Walk-in notification failed: ' . $e->getMessage());
            }

            DB::commit();

            Log::info('Walk-in booking created', [
                'request_id' => $manageRequest->request_id,
                'service_id' => $churchService->service_id,
                'client_user_id' => $client->user_id,
                'secretary_id' => $secretary->user_id,
                'is_resident' => $isResident,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Walk-in booking saved. It is approved and unpaid until the cashier records payment.',
                'data' => [
                    'request_id' => $manageRequest->request_id,
                    'service_type' => $churchService->service_type,
                    'client_name' => $clientName,
                    'preferred_date' => $preferredDate,
                    'preferred_time' => $preferredTime,
                    'is_resident' => $manageRequest->is_resident,
                    'status' => $manageRequest->status,
                    'payment_status' => $manageRequest->payment_status,
                ],
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Walk-in booking failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Could not save the walk-in booking. Please try again.',
            ], 500);
        }
    }

    private function resolveWalkInClient(Request $request, bool $isResident, string $formAddress): User
    {
        $phone = $request->contact_number;
        $existing = User::query()
            ->where('role', 'parishioner')
            ->where('contact_number', $phone)
            ->first();

        if ($existing) {
            $update = [
                'first_name' => $request->first_name,
                'middle_name' => $request->middle_name,
                'last_name' => $request->last_name,
            ];
            if (!$isResident) {
                $update['address'] = $formAddress;
            }
            $existing->update($update);
            Log::info('Walk-in reused parishioner account', [
                'user_id' => $existing->user_id,
                'is_resident' => $isResident,
            ]);
            return $existing->fresh();
        }

        $client = User::create([
            'first_name' => $request->first_name,
            'middle_name' => $request->middle_name,
            'last_name' => $request->last_name,
            'contact_number' => $phone,
            'address' => $formAddress,
            'email' => 'walkin.' . Str::lower(Str::random(10)) . '@parish.local',
            'username' => 'walkin' . substr($phone, -6) . Str::lower(Str::random(4)),
            'password' => Str::random(16),
            'role' => 'parishioner',
            'is_active' => true,
        ]);

        Log::info('Walk-in parishioner account created', ['user_id' => $client->user_id]);
        return $client;
    }
}
