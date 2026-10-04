<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\AppSetting;
use App\Models\CertificateReprint;
use App\Models\ChurchExpense;
use App\Models\Donation;
use App\Models\IssuedCertificate;
use App\Models\ManageRequest;
use App\Models\MassCollection;
use App\Models\PaymentTransaction;
use App\Models\SpecialIntention;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

/**
 * Read-only parish history for the secretary, cashier and priest:
 * every scheduled service with its timeline, the church transaction ledger, and the activity log.
 */
class HistoryController extends Controller
{
    private const MAX_RANGE_DAYS = 366;

    public const TRANSACTION_TYPES = [
        'service_fee' => 'Service payment',
        'reprint' => 'Certificate reprint',
        'mass_collection' => 'Mass collection',
        'donation' => 'Donation',
        'love_offering' => 'Love offering',
        'special_intention' => 'Special intention',
        'expense' => 'Church expense',
    ];

    // ============ SCHEDULED SERVICES ============

    public function services(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'nullable|in:pending,approved,done,cancelled',
            'service_id' => 'nullable|integer',
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date|after_or_equal:date_from',
            'search' => 'nullable|string|max:100',
            'per_page' => 'nullable|integer|min:1|max:100',
        ], [
            'date_to.after_or_equal' => 'The "to" date must be on or after the "from" date.',
        ]);

        if ($validator->fails()) {
            return $this->invalid($validator->errors()->first());
        }

        $query = ManageRequest::with([
            'user:user_id,first_name,middle_name,last_name',
            'service:service_id,service_type,category,fee',
            'assignedPriest:user_id,first_name,middle_name,last_name',
            'baptismForm:baptism_id,child_first_name,child_middle_name,child_last_name',
            'serviceForm:serviceform_id,full_name',
            'certificateForm:certificate_id,full_name',
        ]);

        if ($request->filled('service_id')) {
            $query->where('service_id', (int) $request->service_id);
        }
        if ($request->filled('date_from')) {
            $query->whereDate('preferred_date', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('preferred_date', '<=', $request->date_to);
        }
        if ($request->filled('search')) {
            $search = trim($request->search);
            $requestId = ManageRequest::resolveSearchRequestId($search);
            $query->where(function ($q) use ($search, $requestId) {
                if ($requestId) {
                    $q->orWhere('request_id', $requestId);
                }
                $q->orWhereHas('user', fn ($u) => $u->where('first_name', 'LIKE', "%{$search}%")->orWhere('last_name', 'LIKE', "%{$search}%"))
                    ->orWhereHas('service', fn ($s) => $s->where('service_type', 'LIKE', "%{$search}%"))
                    ->orWhereHas('serviceForm', fn ($f) => $f->where('full_name', 'LIKE', "%{$search}%"))
                    ->orWhereHas('certificateForm', fn ($f) => $f->where('full_name', 'LIKE', "%{$search}%"))
                    ->orWhereHas('baptismForm', fn ($f) => $f->where('child_first_name', 'LIKE', "%{$search}%")
                        ->orWhere('child_last_name', 'LIKE', "%{$search}%"));
            });
        }

        $statusCounts = (clone $query)->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $perPage = (int) $request->input('per_page', 20);
        $rows = $query->orderByDesc('preferred_date')->orderByDesc('preferred_time')->orderByDesc('request_id')->paginate($perPage);
        $rows->getCollection()->transform(fn (ManageRequest $r) => $this->transformRequest($r));

        Log::info('History: services list', ['user' => $request->user()->user_id, 'total' => $rows->total()]);

        return response()->json([
            'success' => true,
            'data' => $rows,
            'status_counts' => [
                'pending' => (int) ($statusCounts['pending'] ?? 0),
                'approved' => (int) ($statusCounts['approved'] ?? 0),
                'done' => (int) ($statusCounts['done'] ?? 0),
                'cancelled' => (int) ($statusCounts['cancelled'] ?? 0),
            ],
        ]);
    }

    public function serviceTimeline(Request $request, $id)
    {
        $manageRequest = ManageRequest::with([
            'user:user_id,first_name,middle_name,last_name',
            'service:service_id,service_type,category,fee',
            'assignedPriest:user_id,first_name,middle_name,last_name',
            'processedBy:user_id,first_name,middle_name,last_name',
            'cancelledBy:user_id,first_name,middle_name,last_name',
            'rescheduledBy:user_id,first_name,middle_name,last_name',
            'baptismForm:baptism_id,child_first_name,child_middle_name,child_last_name',
            'serviceForm:serviceform_id,full_name',
            'certificateForm:certificate_id,full_name',
            'paymentTransactions.receivedBy:user_id,first_name,middle_name,last_name',
        ])->find($id);

        if (!$manageRequest) {
            return response()->json(['success' => false, 'message' => 'This service request was not found.'], 404);
        }

        $logs = $this->logsReady()
            ? ActivityLog::where('request_id', $manageRequest->request_id)->orderBy('created_at')->orderBy('log_id')->get()
            : collect();
        $loggedActions = $logs->where('subject_type', 'request')->map(function (ActivityLog $l) {
            if ($l->action === 'status_changed') {
                return 'status:' . ($l->changes['status']['to'] ?? '');
            }
            return $l->action;
        })->unique()->values()->all();

        $events = collect();
        $events->push($this->event($manageRequest->created_at, 'requested', 'Request submitted',
            "{$this->serviceName($manageRequest)} for {$this->scheduleText($manageRequest->preferred_date, $manageRequest->preferred_time)}",
            $this->name($manageRequest->user)));

        if ($manageRequest->approved_at && !in_array('status:approved', $loggedActions, true)) {
            $events->push($this->event($manageRequest->approved_at, 'approved', 'Approved', null, $this->name($manageRequest->processedBy)));
        }
        if ($manageRequest->rescheduled_by && !in_array('rescheduled', $loggedActions, true)) {
            $events->push($this->event($manageRequest->updated_at, 'rescheduled', 'Rescheduled',
                'Now on ' . $this->scheduleText($manageRequest->preferred_date, $manageRequest->preferred_time)
                . ($manageRequest->reschedule_reason ? ". Reason: {$manageRequest->reschedule_reason}" : ''),
                $this->name($manageRequest->rescheduledBy)));
        }
        if ($manageRequest->assigned_priest && !in_array('priest_assigned', $loggedActions, true)) {
            $events->push($this->event($manageRequest->approved_at ?? $manageRequest->created_at, 'priest_assigned', 'Priest assigned',
                'Fr. ' . $this->name($manageRequest->assignedPriest), null));
        }
        foreach ($manageRequest->paymentTransactions as $payment) {
            $events->push($this->event($payment->created_at, 'paid', 'Payment received',
                ($payment->or_number ? "OR {$payment->or_number}" : 'No OR number') . ($payment->notes ? " · {$payment->notes}" : ''),
                $this->name($payment->receivedBy), (float) $payment->amount));
        }
        if ($manageRequest->completed_at && !in_array('status:done', $loggedActions, true)) {
            $events->push($this->event($manageRequest->completed_at, 'completed', 'Service completed', null, null));
        }
        if ($manageRequest->status === 'cancelled' && !in_array('status:cancelled', $loggedActions, true)) {
            $events->push($this->event($manageRequest->updated_at, 'cancelled', 'Cancelled',
                $manageRequest->cancelled_reason ? "Reason: {$manageRequest->cancelled_reason}" : null,
                $manageRequest->cancelledBy ? $this->name($manageRequest->cancelledBy) : 'System'));
        }

        IssuedCertificate::where('request_id', $manageRequest->request_id)
            ->with('issuedBy:user_id,first_name,middle_name,last_name')
            ->get()
            ->each(fn (IssuedCertificate $c) => $events->push($this->event($c->created_at, 'certificate',
                ucfirst((string) $c->certificate_type) . ' certificate issued', $c->person_name, $this->name($c->issuedBy))));

        foreach ($logs as $log) {
            if (in_array($log->subject_type, ['payment', 'certificate'], true) || $log->action === 'created' && $log->subject_type === 'request') {
                continue;
            }
            $type = match (true) {
                $log->action === 'status_changed' && ($log->changes['status']['to'] ?? null) === 'approved' => 'approved',
                $log->action === 'status_changed' && ($log->changes['status']['to'] ?? null) === 'done' => 'completed',
                $log->action === 'status_changed' && ($log->changes['status']['to'] ?? null) === 'cancelled' => 'cancelled',
                in_array($log->action, ['rescheduled', 'priest_assigned'], true) => $log->action,
                default => 'edited',
            };
            $events->push($this->event($log->created_at, $type, $this->timelineTitle($type), $log->description,
                $log->user_name ?: 'System', $log->amount !== null ? (float) $log->amount : null));
        }

        $sorted = $events->filter(fn ($e) => $e['at'] !== null)->sortBy('at')->values();

        return response()->json([
            'success' => true,
            'data' => [
                'request' => $this->transformRequest($manageRequest),
                'events' => $sorted,
            ],
        ]);
    }

    // ============ CHURCH TRANSACTIONS ============

    public function transactions(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date|after_or_equal:date_from',
            'direction' => 'nullable|in:all,in,out',
            'type' => 'nullable|in:' . implode(',', array_keys(self::TRANSACTION_TYPES)),
            'search' => 'nullable|string|max:100',
            'per_page' => 'nullable|integer|min:1|max:100',
            'all' => 'nullable|boolean',
        ], [
            'date_to.after_or_equal' => 'The "to" date must be on or after the "from" date.',
        ]);

        if ($validator->fails()) {
            return $this->invalid($validator->errors()->first());
        }

        $from = $request->filled('date_from') ? Carbon::parse($request->date_from)->startOfDay() : now()->startOfMonth();
        $to = $request->filled('date_to') ? Carbon::parse($request->date_to)->endOfDay() : now()->endOfDay();
        if ($from->diffInDays($to) > self::MAX_RANGE_DAYS) {
            return $this->invalid('Please choose a period of one year or less.');
        }

        $entries = $this->ledgerBetween($from, $to);

        $income = $entries->where('direction', 'in');
        $expenses = $entries->where('direction', 'out');
        $incomeTotal = round((float) $income->sum('amount_in'), 2);
        $expenseTotal = round((float) $expenses->sum('amount_out'), 2);
        $sharing = AppSetting::splitIncome($incomeTotal);

        $byType = collect(self::TRANSACTION_TYPES)->map(fn ($label, $key) => [
            'type' => $key,
            'label' => $label,
            'count' => $entries->where('type', $key)->count(),
            'amount' => round((float) $entries->where('type', $key)->sum(fn ($e) => $e['amount_in'] + $e['amount_out']), 2),
        ])->values();

        $filtered = $entries;
        if (in_array($request->direction, ['in', 'out'], true)) {
            $filtered = $filtered->where('direction', $request->direction);
        }
        if ($request->filled('type')) {
            $filtered = $filtered->where('type', $request->type);
        }
        if ($request->filled('search')) {
            $needle = mb_strtolower(trim($request->search));
            $filtered = $filtered->filter(fn ($e) => str_contains(mb_strtolower(
                $e['description'] . ' ' . ($e['reference'] ?? '') . ' ' . ($e['recorded_by'] ?? '') . ' ' . ($e['party'] ?? '')
            ), $needle));
        }
        $filtered = $filtered->sortByDesc('date_time')->values();

        $summary = [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'income_total' => $incomeTotal,
            'expense_total' => $expenseTotal,
            'net' => round($incomeTotal - $expenseTotal, 2),
            'sharing' => $sharing,
            'church_net' => round($sharing['church_amount'] - $expenseTotal, 2),
            'by_type' => $byType,
            'filtered_in' => round((float) $filtered->sum('amount_in'), 2),
            'filtered_out' => round((float) $filtered->sum('amount_out'), 2),
        ];

        Log::info('History: transactions ledger', [
            'user' => $request->user()->user_id,
            'from' => $summary['from'],
            'to' => $summary['to'],
            'rows' => $filtered->count(),
        ]);

        if ($request->boolean('all')) {
            return response()->json([
                'success' => true,
                'data' => ['items' => $filtered->take(5000)->values(), 'total' => $filtered->count()],
                'summary' => $summary,
            ]);
        }

        $perPage = (int) $request->input('per_page', 25);
        $page = max(1, (int) $request->input('page', 1));
        $paginator = new LengthAwarePaginator(
            $filtered->forPage($page, $perPage)->values(),
            $filtered->count(),
            $perPage,
            $page
        );

        return response()->json([
            'success' => true,
            'data' => $paginator,
            'summary' => $summary,
        ]);
    }

    // ============ ACTIVITY LOG ============

    public function activity(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date|after_or_equal:date_from',
            'subject_type' => 'nullable|in:' . implode(',', array_keys(ActivityLog::SUBJECT_LABELS)),
            'action' => 'nullable|string|max:30',
            'search' => 'nullable|string|max:100',
            'per_page' => 'nullable|integer|min:1|max:100',
        ], [
            'date_to.after_or_equal' => 'The "to" date must be on or after the "from" date.',
        ]);

        if ($validator->fails()) {
            return $this->invalid($validator->errors()->first());
        }

        if (!$this->logsReady()) {
            return response()->json([
                'success' => true,
                'data' => new LengthAwarePaginator([], 0, 25, 1),
                'started_at' => null,
                'subject_types' => ActivityLog::SUBJECT_LABELS,
            ]);
        }

        $query = ActivityLog::query();
        if ($request->filled('date_from')) {
            $query->where('created_at', '>=', Carbon::parse($request->date_from)->startOfDay());
        }
        if ($request->filled('date_to')) {
            $query->where('created_at', '<=', Carbon::parse($request->date_to)->endOfDay());
        }
        if ($request->filled('subject_type')) {
            $query->where('subject_type', $request->subject_type);
        }
        if ($request->filled('action')) {
            $query->where('action', $request->action);
        }
        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(fn ($q) => $q->where('description', 'LIKE', "%{$search}%")->orWhere('user_name', 'LIKE', "%{$search}%"));
        }

        $perPage = (int) $request->input('per_page', 25);
        $rows = $query->orderByDesc('created_at')->orderByDesc('log_id')->paginate($perPage);
        $rows->getCollection()->transform(fn (ActivityLog $l) => $l->toApiArray());

        return response()->json([
            'success' => true,
            'data' => $rows,
            'started_at' => ActivityLog::min('created_at'),
            'subject_types' => ActivityLog::SUBJECT_LABELS,
        ]);
    }

    // ============ HELPERS ============

    private function ledgerBetween(Carbon $from, Carbon $to): Collection
    {
        $users = 'user_id,first_name,middle_name,last_name';

        $payments = PaymentTransaction::with([
            "receivedBy:{$users}",
            'request:request_id,user_id,service_id,service_form_id,certificate_form_id,baptism_form_id',
            'request.service:service_id,service_type',
            "request.user:{$users}",
            'request.serviceForm:serviceform_id,full_name',
            'request.certificateForm:certificate_id,full_name',
            'request.baptismForm:baptism_id,child_first_name,child_middle_name,child_last_name',
        ])->whereBetween('created_at', [$from, $to])->get()
            ->map(fn (PaymentTransaction $p) => $this->entry(
                $p->created_at, 'service_fee', 'in', (float) $p->amount,
                ($p->request?->service?->service_type ?? 'Service') . ' fee',
                $p->request ? $this->clientName($p->request) : null,
                $p->or_number ? "OR {$p->or_number}" : ManageRequest::formatRequestReference($p->request_id),
                $this->name($p->receivedBy), $p->request_id
            ));

        $reprints = CertificateReprint::income()->with("paidBy:{$users}")
            ->whereBetween('paid_at', [$from, $to])->get()
            ->map(fn (CertificateReprint $r) => $this->entry(
                $r->paid_at, 'reprint', 'in', (float) $r->amount,
                ucfirst((string) $r->certificate_type) . ' certificate reprint', $r->person_name,
                $r->or_number ? "OR {$r->or_number}" : 'RP-' . $r->reprint_id, $this->name($r->paidBy)
            ));

        $mass = MassCollection::received()->with(["recordedBy:{$users}", "receivedBy:{$users}"])
            ->whereBetween('received_at', [$from, $to])->get()
            ->map(fn (MassCollection $m) => $this->entry(
                $m->received_at, 'mass_collection', 'in', (float) $m->amount,
                "{$m->mass_type} collection (" . $m->mass_date?->format('M j, Y') . ')', null,
                'MC-' . $m->collection_id, $this->name($m->recordedBy), null, $this->name($m->receivedBy)
            ));

        $donations = Donation::received()->with(["recordedBy:{$users}", "receivedBy:{$users}"])
            ->whereBetween('received_at', [$from, $to])->get()
            ->map(fn (Donation $d) => $this->entry(
                $d->received_at, $d->contribution_type === 'donation' ? 'donation' : 'love_offering', 'in', (float) $d->amount,
                $d->contribution_type === 'donation' ? 'Donation' : 'Love offering', $d->donor_name ?: 'Anonymous',
                'DN-' . $d->donation_id, $this->name($d->recordedBy), null, $this->name($d->receivedBy)
            ));

        $intentions = SpecialIntention::received()->with(["recordedBy:{$users}", "receivedBy:{$users}"])
            ->whereBetween('received_at', [$from, $to])->get()
            ->map(fn (SpecialIntention $s) => $this->entry(
                $s->received_at, 'special_intention', 'in', (float) $s->amount,
                'Special intention (' . $s->intention_date?->format('M j, Y') . ')', $s->parishioner_name,
                'SI-' . $s->intention_id, $this->name($s->recordedBy), $s->request_id, $this->name($s->receivedBy)
            ));

        $expenses = ChurchExpense::verified()->with(["recordedBy:{$users}", "reviewedBy:{$users}"])
            ->whereBetween('expense_date', [$from->toDateString(), $to->toDateString()])->get()
            ->map(fn (ChurchExpense $e) => $this->entry(
                $e->expense_date?->copy()->setTimeFrom($e->reviewed_at ?? $e->created_at ?? now()), 'expense', 'out', (float) $e->amount,
                "{$e->category_label}: {$e->description}", $e->payee_name,
                $e->reference_no ?: 'EX-' . $e->expense_id, $this->name($e->recordedBy), null, $this->name($e->reviewedBy)
            ));

        return collect()
            ->concat($payments)->concat($reprints)->concat($mass)
            ->concat($donations)->concat($intentions)->concat($expenses)
            ->values();
    }

    private function entry($at, string $type, string $direction, float $amount, string $description, ?string $party,
        ?string $reference, ?string $recordedBy, $requestId = null, ?string $approvedBy = null): array
    {
        $at = $at ? Carbon::parse($at) : null;

        return [
            'key' => $type . '-' . ($reference ?? '') . '-' . ($at?->timestamp ?? 0),
            'date_time' => $at?->toIso8601String(),
            'date' => $at?->toDateString(),
            'type' => $type,
            'type_label' => self::TRANSACTION_TYPES[$type],
            'direction' => $direction,
            'description' => $description,
            'party' => $party,
            'reference' => $reference,
            'amount_in' => $direction === 'in' ? round($amount, 2) : 0.0,
            'amount_out' => $direction === 'out' ? round($amount, 2) : 0.0,
            'recorded_by' => $recordedBy,
            'approved_by' => $approvedBy,
            'request_id' => $requestId,
        ];
    }

    private function transformRequest(ManageRequest $r): array
    {
        return [
            'request_id' => $r->request_id,
            'reference' => ManageRequest::formatRequestReference($r->request_id),
            'service_type' => $this->serviceName($r),
            'category' => $r->service?->category,
            'client_name' => $this->clientName($r),
            'requested_by' => $this->name($r->user),
            'preferred_date' => $r->preferred_date?->format('Y-m-d'),
            'preferred_time' => $r->preferred_time ? Carbon::parse($r->preferred_time)->format('H:i') : null,
            'status' => $r->status,
            'payment_status' => $r->payment_status,
            'fee' => (float) ($r->service?->fee ?? 0),
            'amount_paid' => (float) $r->amount_paid,
            'assigned_priest' => $r->assignedPriest ? 'Fr. ' . $this->name($r->assignedPriest) : null,
            'was_rescheduled' => (bool) $r->rescheduled_by,
            'reschedule_reason' => $r->reschedule_reason,
            'cancelled_reason' => $r->cancelled_reason,
            'created_at' => $r->created_at?->toIso8601String(),
            'approved_at' => $r->approved_at?->toIso8601String(),
            'completed_at' => $r->completed_at?->toIso8601String(),
        ];
    }

    private function clientName(ManageRequest $r): ?string
    {
        if ($r->baptism_form_id && $r->baptismForm) {
            return trim(preg_replace('/\s+/', ' ', "{$r->baptismForm->child_first_name} {$r->baptismForm->child_middle_name} {$r->baptismForm->child_last_name}"));
        }
        if ($r->service_form_id && $r->serviceForm) {
            return $r->serviceForm->full_name;
        }
        if ($r->certificate_form_id && $r->certificateForm) {
            return $r->certificateForm->full_name;
        }
        return $this->name($r->user);
    }

    private function serviceName(ManageRequest $r): string
    {
        return $r->service?->service_type ?? 'Service';
    }

    private function scheduleText($date, $time): string
    {
        $d = $date ? Carbon::parse($date)->format('M j, Y') : 'no date';
        $t = $time ? Carbon::parse($time)->format('g:i A') : '';
        return trim("{$d} {$t}");
    }

    private function name(?User $user): ?string
    {
        return $user ? trim(preg_replace('/\s+/', ' ', $user->full_name)) : null;
    }

    private function event($at, string $type, string $title, ?string $detail, ?string $by, ?float $amount = null): array
    {
        return [
            'at' => $at ? Carbon::parse($at)->toIso8601String() : null,
            'type' => $type,
            'title' => $title,
            'detail' => $detail,
            'by' => $by,
            'amount' => $amount,
        ];
    }

    private function timelineTitle(string $type): string
    {
        return match ($type) {
            'approved' => 'Approved',
            'completed' => 'Service completed',
            'cancelled' => 'Cancelled',
            'rescheduled' => 'Rescheduled',
            'priest_assigned' => 'Priest assigned',
            default => 'Edited',
        };
    }

    private function logsReady(): bool
    {
        static $ready = null;
        return $ready ??= Schema::hasTable('activity_logs');
    }

    private function invalid(string $message)
    {
        return response()->json(['success' => false, 'message' => $message], 422);
    }
}
