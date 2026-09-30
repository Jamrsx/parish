<?php

namespace App\Http\Controllers;

use App\Models\BaptismForm;
use App\Models\IssuedCertificate;
use App\Models\ManageRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class CertificateController extends Controller
{
    private const BAPTISM_STATUSES = ['approved', 'done'];
    private const CERTIFICATE_REQUEST_STATUSES = ['pending', 'approved', 'done'];

    /**
     * People baptized through the system (baptism requests), ready to fill a certificate.
     */
    public function baptismRecords(Request $request)
    {
        $search = trim((string) $request->query('search', ''));

        $query = ManageRequest::query()
            ->whereNotNull('baptism_form_id')
            ->whereIn('status', self::BAPTISM_STATUSES)
            ->with(['baptismForm.godparents', 'assignedPriest:user_id,first_name,middle_name,last_name'])
            ->orderByDesc('preferred_date');

        if ($search !== '') {
            $query->whereHas('baptismForm', function ($q) use ($search) {
                $like = "%{$search}%";
                $q->where('child_first_name', 'LIKE', $like)
                    ->orWhere('child_middle_name', 'LIKE', $like)
                    ->orWhere('child_last_name', 'LIKE', $like)
                    ->orWhere('father_first_name', 'LIKE', $like)
                    ->orWhere('father_last_name', 'LIKE', $like)
                    ->orWhere('mother_first_name', 'LIKE', $like)
                    ->orWhere('mother_last_name', 'LIKE', $like)
                    ->orWhereRaw("CONCAT_WS(' ', child_first_name, child_middle_name, child_last_name) LIKE ?", [$like])
                    ->orWhereRaw("CONCAT_WS(' ', child_first_name, child_last_name) LIKE ?", [$like]);
            });
        }

        $records = $query->limit(100)->get()
            ->filter(fn (ManageRequest $r) => $r->baptismForm !== null)
            ->map(fn (ManageRequest $r) => $this->baptismRecordPayload($r))
            ->values();

        Log::info('Certificates: baptism records listed', ['search' => $search, 'count' => $records->count()]);

        return response()->json(['success' => true, 'data' => $records]);
    }

    /**
     * Baptismal Certificate requests, each matched to a baptism record when one exists.
     */
    public function certificateRequests(Request $request)
    {
        $search = trim((string) $request->query('search', ''));

        $query = ManageRequest::query()
            ->whereNotNull('certificate_form_id')
            ->whereIn('status', self::CERTIFICATE_REQUEST_STATUSES)
            ->whereHas('service', function ($q) {
                $q->where('form_handler', 'baptismal_certificate')
                    ->orWhere('service_type', 'LIKE', '%baptismal%');
            })
            ->with(['certificateForm', 'user:user_id,first_name,middle_name,last_name,email', 'service:service_id,service_type'])
            ->orderByRaw("FIELD(status, 'approved', 'pending', 'done')")
            ->orderByDesc('created_at');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $like = "%{$search}%";
                $q->whereHas('certificateForm', function ($c) use ($like) {
                    $c->where('full_name', 'LIKE', $like)
                        ->orWhere('father_name', 'LIKE', $like)
                        ->orWhere('mother_name', 'LIKE', $like);
                })->orWhereHas('user', function ($u) use ($like) {
                    $u->where('first_name', 'LIKE', $like)->orWhere('last_name', 'LIKE', $like);
                });
                if (ctype_digit(ltrim($search, '#'))) {
                    $q->orWhere('request_id', (int) ltrim($search, '#'));
                }
            });
        }

        $rows = $query->limit(100)->get()
            ->filter(fn (ManageRequest $r) => $r->certificateForm !== null)
            ->map(function (ManageRequest $r) {
                $form = $r->certificateForm;
                $match = $this->findMatchingBaptism($form->full_name, $form->birth_date?->format('Y-m-d'));

                return [
                    'request_id' => $r->request_id,
                    'status' => $r->status,
                    'payment_status' => $r->payment_status,
                    'requested_by' => $r->user?->full_name,
                    'requested_at' => $r->created_at?->format('Y-m-d'),
                    'person_name' => $form->full_name,
                    'father_name' => $form->father_name,
                    'mother_name' => $form->mother_name,
                    'birth_date' => $form->birth_date?->format('Y-m-d'),
                    'birth_place' => $form->birth_place,
                    'baptism_date' => $form->baptism_date?->format('Y-m-d'),
                    'matched_record' => $match ? $this->baptismRecordPayload($match) : null,
                ];
            })
            ->values();

        Log::info('Certificates: certificate requests listed', ['search' => $search, 'count' => $rows->count()]);

        return response()->json(['success' => true, 'data' => $rows]);
    }

    /**
     * Save an issued certificate to the history (and the register numbers onto the baptism record).
     */
    public function issue(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'certificate_type' => 'required|in:baptismal',
            'person_name' => 'required|string|max:150',
            'father_name' => 'nullable|string|max:150',
            'mother_name' => 'nullable|string|max:150',
            'birth_date' => 'required|date|before_or_equal:today',
            'birth_place' => 'nullable|string|max:150',
            'baptism_date' => 'required|date|after_or_equal:birth_date|before_or_equal:today',
            'minister_name' => 'required|string|max:150',
            'sponsors' => 'nullable|array|max:8',
            'sponsors.*' => 'nullable|string|max:100',
            'register_no' => 'nullable|string|max:20',
            'register_page' => 'nullable|string|max:20',
            'register_line' => 'nullable|string|max:20',
            'purpose' => 'nullable|string|max:150',
            'date_issued' => 'required|date',
            'signatory_priest_id' => 'nullable|integer|exists:users,user_id',
            'signatory_name' => 'required|string|max:150',
            'baptism_id' => 'nullable|integer|exists:baptism_forms,baptism_id',
            'request_id' => 'nullable|integer|exists:manage_requests,request_id',
        ], [
            'baptism_date.after_or_equal' => 'The baptism date cannot be before the birth date.',
            'baptism_date.before_or_equal' => 'The baptism date cannot be in the future.',
            'birth_date.before_or_equal' => 'The birth date cannot be in the future.',
            'minister_name.required' => 'Enter the priest who performed the baptism.',
            'signatory_name.required' => 'Choose the parish priest who will sign the certificate.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        if ($request->filled('signatory_priest_id')) {
            $signatory = User::find($request->signatory_priest_id);
            if (!$signatory || !$signatory->isPriest()) {
                return response()->json([
                    'success' => false,
                    'message' => 'The selected signatory is not a priest.',
                ], 422);
            }
        }

        $clean = fn ($value) => filled($value) ? trim((string) $value) : null;
        $sponsors = collect($request->input('sponsors', []))
            ->map(fn ($name) => $clean($name))
            ->filter()
            ->values()
            ->all();

        $details = [
            'person_name' => $clean($request->person_name),
            'father_name' => $clean($request->father_name),
            'mother_name' => $clean($request->mother_name),
            'birth_date' => Carbon::parse($request->birth_date)->format('Y-m-d'),
            'birth_place' => $clean($request->birth_place),
            'baptism_date' => Carbon::parse($request->baptism_date)->format('Y-m-d'),
            'minister_name' => $clean($request->minister_name),
            'sponsors' => $sponsors,
            'register_no' => $clean($request->register_no),
            'register_page' => $clean($request->register_page),
            'register_line' => $clean($request->register_line),
            'purpose' => $clean($request->purpose),
            'date_issued' => Carbon::parse($request->date_issued)->format('Y-m-d'),
            'signatory_name' => $clean($request->signatory_name),
        ];

        $issued = DB::transaction(function () use ($request, $details) {
            $issued = IssuedCertificate::create([
                'certificate_type' => $request->certificate_type,
                'person_name' => $details['person_name'],
                'baptism_id' => $request->baptism_id,
                'request_id' => $request->request_id,
                'purpose' => $details['purpose'],
                'date_issued' => $details['date_issued'],
                'signatory_name' => $details['signatory_name'],
                'signatory_priest_id' => $request->signatory_priest_id,
                'details' => $details,
                'issued_by' => auth('sanctum')->id(),
            ]);

            if ($request->filled('baptism_id')) {
                $registerUpdates = array_filter([
                    'register_no' => $details['register_no'],
                    'register_page' => $details['register_page'],
                    'register_line' => $details['register_line'],
                ], fn ($v) => $v !== null);

                if ($registerUpdates) {
                    BaptismForm::where('baptism_id', $request->baptism_id)->update($registerUpdates);
                }
            }

            return $issued;
        });

        Log::info('Certificates: certificate issued', [
            'issued_certificate_id' => $issued->issued_certificate_id,
            'person_name' => $issued->person_name,
            'baptism_id' => $issued->baptism_id,
            'request_id' => $issued->request_id,
            'issued_by' => $issued->issued_by,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Certificate saved to the issued history.',
            'data' => $this->issuedPayload($issued->load('issuedBy:user_id,first_name,middle_name,last_name')),
        ], 201);
    }

    /**
     * History of issued certificates.
     */
    public function issued(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'search' => 'nullable|string|max:150',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $search = trim((string) $request->query('search', ''));
        $perPage = (int) ($request->query('per_page') ?: 10);

        $query = IssuedCertificate::query()
            ->with('issuedBy:user_id,first_name,middle_name,last_name')
            ->orderByDesc('created_at');

        if ($search !== '') {
            $like = "%{$search}%";
            $query->where(function ($q) use ($like) {
                $q->where('person_name', 'LIKE', $like)
                    ->orWhere('purpose', 'LIKE', $like)
                    ->orWhere('signatory_name', 'LIKE', $like);
            });
        }

        $page = $query->paginate($perPage)->through(fn (IssuedCertificate $c) => $this->issuedPayload($c));

        return response()->json(['success' => true, 'data' => $page]);
    }

    private function baptismRecordPayload(ManageRequest $request): array
    {
        $form = $request->baptismForm;
        $godparents = $form->godparents ?? collect();

        $sponsors = $godparents
            ->sortBy(fn ($gp) => $gp->relationship === 'godfather' ? 0 : 1)
            ->pluck('godparent_name')
            ->filter()
            ->values()
            ->all();

        return [
            'baptism_id' => $form->baptism_id,
            'request_id' => $request->request_id,
            'status' => $request->status,
            'person_name' => $this->joinName($form->child_first_name, $form->child_middle_name, $form->child_last_name),
            'father_name' => $this->joinName($form->father_first_name, $form->father_middle_name, $form->father_last_name),
            'mother_name' => $this->joinName($form->mother_first_name, $form->mother_middle_name, $form->mother_last_name),
            'birth_date' => $form->child_birth_date?->format('Y-m-d'),
            'birth_place' => $form->child_birth_place,
            'baptism_date' => $request->preferred_date?->format('Y-m-d'),
            'minister_name' => $request->assignedPriest?->full_name,
            'sponsors' => $sponsors,
            'register_no' => $form->register_no,
            'register_page' => $form->register_page,
            'register_line' => $form->register_line,
        ];
    }

    private function findMatchingBaptism(?string $fullName, ?string $birthDate): ?ManageRequest
    {
        if (!$fullName || !$birthDate) {
            return null;
        }

        $target = $this->normalizeName($fullName);

        $candidates = ManageRequest::query()
            ->whereNotNull('baptism_form_id')
            ->whereIn('status', self::BAPTISM_STATUSES)
            ->whereHas('baptismForm', fn ($q) => $q->whereDate('child_birth_date', $birthDate))
            ->with(['baptismForm.godparents', 'assignedPriest:user_id,first_name,middle_name,last_name'])
            ->get();

        return $candidates->first(function (ManageRequest $r) use ($target) {
            $f = $r->baptismForm;
            if (!$f) {
                return false;
            }
            $withMiddle = $this->normalizeName($this->joinName($f->child_first_name, $f->child_middle_name, $f->child_last_name));
            $withoutMiddle = $this->normalizeName($this->joinName($f->child_first_name, null, $f->child_last_name));

            return $target === $withMiddle || $target === $withoutMiddle;
        });
    }

    private function issuedPayload(IssuedCertificate $c): array
    {
        return [
            'issued_certificate_id' => $c->issued_certificate_id,
            'certificate_type' => $c->certificate_type,
            'person_name' => $c->person_name,
            'purpose' => $c->purpose,
            'date_issued' => $c->date_issued?->format('Y-m-d'),
            'signatory_name' => $c->signatory_name,
            'baptism_id' => $c->baptism_id,
            'request_id' => $c->request_id,
            'details' => $c->details,
            'issued_by' => $c->issuedBy?->full_name,
            'created_at' => $c->created_at?->toIso8601String(),
        ];
    }

    private function joinName(?string ...$parts): string
    {
        return trim(implode(' ', array_filter(array_map(fn ($p) => trim((string) $p), $parts))));
    }

    private function normalizeName(string $name): string
    {
        return preg_replace('/[^a-z]/', '', strtolower($name));
    }
}
