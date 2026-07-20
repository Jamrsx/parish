<?php

namespace App\Http\Controllers;

use App\Models\Donation;
use App\Models\ManageRequest;
use App\Models\MassCollection;
use App\Models\PaymentTransaction;
use App\Models\SpecialIntention;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CashierController extends Controller
{
    public function dashboard()
    {
        $today = Carbon::today();

        $unpaidCount = ManageRequest::query()
            ->whereIn('status', ['approved', 'done'])
            ->whereIn('payment_status', ['unpaid', 'partial'])
            ->whereDoesntHave('service', function ($q) {
                $q->where('form_handler', 'special_intention')
                    ->orWhere('service_type', 'Special Intention');
            })
            ->count();

        $servicePaymentsToday = PaymentTransaction::whereDate('created_at', $today)->sum('amount');
        $servicePaymentsTodayCount = PaymentTransaction::whereDate('created_at', $today)->count();

        $massCollectionsToday = MassCollection::received()
            ->whereDate('received_at', $today)
            ->sum('amount');
        $pendingDonations = Donation::pending()->count();
        $pendingMass = MassCollection::pending()->count();
        $pendingIntentions = SpecialIntention::awaitingCashier()->count();
        $donationsReceivedToday = Donation::received()
            ->whereDate('received_at', $today)
            ->sum('amount');
        $intentionsReceivedToday = SpecialIntention::received()
            ->whereDate('received_at', $today)
            ->sum('amount');

        $recentPayments = PaymentTransaction::with([
            'request.user',
            'request.service',
            'receivedBy',
        ])
            ->orderByDesc('created_at')
            ->limit(8)
            ->get()
            ->map(fn ($p) => $this->transformPayment($p));

        $recentMass = MassCollection::received()
            ->with(['recordedBy', 'receivedBy'])
            ->orderByDesc('received_at')
            ->limit(5)
            ->get()
            ->map(fn ($m) => $this->transformMass($m));

        return response()->json([
            'success' => true,
            'data' => [
                'unpaid_count' => $unpaidCount,
                'pending_donations' => $pendingDonations,
                'pending_mass_collections' => $pendingMass,
                'pending_special_intentions' => $pendingIntentions,
                'service_payments_today' => (float) $servicePaymentsToday,
                'service_payments_today_count' => $servicePaymentsTodayCount,
                'mass_collections_today' => (float) $massCollectionsToday,
                'donations_received_today' => (float) $donationsReceivedToday,
                'special_intentions_today' => (float) $intentionsReceivedToday,
                'recent_payments' => $recentPayments,
                'recent_mass_collections' => $recentMass,
                'date' => $today->format('Y-m-d'),
            ],
        ]);
    }

    /**
     * Requests awaiting cash payment (approved/done + unpaid/partial).
     */
    public function unpaidRequests(Request $request)
    {
        $query = ManageRequest::with(['user', 'service', 'baptismForm', 'serviceForm', 'certificateForm'])
            ->whereIn('status', ['approved', 'done'])
            ->whereIn('payment_status', ['unpaid', 'partial'])
            // Special intentions use the dedicated Special Intentions cashier flow (any amount / ₱0).
            ->whereDoesntHave('service', function ($q) {
                $q->where('form_handler', 'special_intention')
                    ->orWhere('service_type', 'Special Intention');
            });

        if ($request->filled('search')) {
            $search = $request->search;
            $requestId = ManageRequest::resolveSearchRequestId($search);
            $query->where(function ($q) use ($search, $requestId) {
                $q->whereHas('user', function ($sub) use ($search) {
                    $sub->where('first_name', 'LIKE', "%{$search}%")
                        ->orWhere('last_name', 'LIKE', "%{$search}%")
                        ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$search}%"]);
                })->orWhereHas('service', function ($sub) use ($search) {
                    $sub->where('service_type', 'LIKE', "%{$search}%");
                });
                if ($requestId !== null) {
                    $q->orWhere('request_id', $requestId);
                }
                $q->orWhere('request_id', 'LIKE', "%{$search}%");
            });
        }

        if ($request->filled('payment_status') && $request->payment_status !== 'all') {
            $query->where('payment_status', $request->payment_status);
        }

        $perPage = $request->input('per_page', 20);
        $requests = $query->orderByDesc('created_at')->paginate($perPage);

        $requests->getCollection()->transform(function ($req) {
            return [
                'request_id' => $req->request_id,
                'user' => $req->user ? [
                    'user_id' => $req->user->user_id,
                    'full_name' => $req->user->full_name,
                    'first_name' => $req->user->first_name,
                    'last_name' => $req->user->last_name,
                ] : null,
                'service' => $req->service ? [
                    'service_id' => $req->service->service_id,
                    'service_type' => $req->service->service_type,
                    'fee' => (float) $req->service->fee,
                ] : null,
                'preferred_date' => $req->preferred_date?->format('Y-m-d'),
                'preferred_time' => $req->preferred_time ? Carbon::parse($req->preferred_time)->format('H:i') : null,
                'status' => $req->status,
                'payment_status' => $req->payment_status,
                'amount_paid' => (float) $req->amount_paid,
                'remaining_balance' => (float) $req->remaining_balance,
                'form_summary' => $req->form_summary,
                'created_at' => $req->created_at?->toIso8601String(),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $requests,
        ]);
    }

    public function transactions(Request $request)
    {
        $query = PaymentTransaction::with(['request.user', 'request.service', 'receivedBy']);

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('or_number', 'LIKE', "%{$search}%")
                    ->orWhereHas('request.user', function ($sub) use ($search) {
                        $sub->where('first_name', 'LIKE', "%{$search}%")
                            ->orWhere('last_name', 'LIKE', "%{$search}%");
                    })
                    ->orWhereHas('request.service', function ($sub) use ($search) {
                        $sub->where('service_type', 'LIKE', "%{$search}%");
                    });
            });
        }

        $perPage = $request->input('per_page', 20);
        $rows = $query->orderByDesc('created_at')->paginate($perPage);
        $rows->getCollection()->transform(fn ($p) => $this->transformPayment($p));

        return response()->json([
            'success' => true,
            'data' => $rows,
        ]);
    }

    public function dailyReport(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'date' => 'required|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $date = Carbon::parse($request->date)->format('Y-m-d');

        $servicePayments = PaymentTransaction::with(['request.user', 'request.service', 'receivedBy'])
            ->whereDate('created_at', $date)
            ->orderBy('created_at')
            ->get()
            ->map(fn ($p) => $this->transformPayment($p));

        $massCollections = MassCollection::with(['recordedBy', 'receivedBy'])
            ->where('status', 'received')
            ->whereDate('received_at', $date)
            ->orderBy('received_at')
            ->get()
            ->map(fn ($m) => $this->transformMass($m));

        $donations = Donation::with(['recordedBy', 'receivedBy'])
            ->where('status', 'received')
            ->whereDate('received_at', $date)
            ->orderBy('received_at')
            ->get()
            ->map(fn ($d) => $this->transformDonation($d));

        $intentions = SpecialIntention::with(['recordedBy', 'receivedBy'])
            ->where('status', 'received')
            ->whereDate('received_at', $date)
            ->orderBy('received_at')
            ->get()
            ->map(fn ($row) => $this->transformIntention($row));

        $serviceTotal = (float) $servicePayments->sum('amount');
        $massTotal = (float) $massCollections->sum('amount');
        $donationTotal = (float) $donations->sum('amount');
        $intentionTotal = (float) $intentions->sum('amount');

        return response()->json([
            'success' => true,
            'data' => [
                'date' => $date,
                'service_payments' => $servicePayments,
                'service_fees_total' => $serviceTotal,
                'mass_collections' => $massCollections,
                'mass_collections_total' => $massTotal,
                'donations' => $donations,
                'donations_total' => $donationTotal,
                'special_intentions' => $intentions,
                'special_intentions_total' => $intentionTotal,
                'income_for_date' => $serviceTotal + $massTotal + $donationTotal + $intentionTotal,
            ],
        ]);
    }

    private function transformPayment(PaymentTransaction $p): array
    {
        return [
            'payment_id' => $p->payment_id,
            'request_id' => $p->request_id,
            'amount' => (float) $p->amount,
            'or_number' => $p->or_number,
            'notes' => $p->notes,
            'created_at' => $p->created_at?->toIso8601String(),
            'parishioner' => $p->request?->user?->full_name,
            'service_type' => $p->request?->service?->service_type,
            'received_by' => $p->receivedBy?->full_name,
        ];
    }

    private function transformMass(MassCollection $m): array
    {
        $time = $m->mass_time;
        if ($time) {
            try {
                $time = Carbon::parse($time)->format('H:i');
            } catch (\Exception $e) {
                $time = substr((string) $time, 0, 5);
            }
        }

        return [
            'collection_id' => $m->collection_id,
            'mass_date' => $m->mass_date?->format('Y-m-d'),
            'mass_type' => $m->mass_type,
            'mass_time' => $time,
            'amount' => (float) $m->amount,
            'denomination_breakdown' => $m->denomination_breakdown ?: [],
            'notes' => $m->notes,
            'status' => $m->status,
            'recorded_by' => $m->recordedBy?->full_name,
            'received_by' => $m->receivedBy?->full_name,
            'received_at' => $m->received_at?->toIso8601String(),
            'reject_reason' => $m->reject_reason,
            'created_at' => $m->created_at?->toIso8601String(),
        ];
    }

    private function transformDonation(Donation $d): array
    {
        return [
            'donation_id' => $d->donation_id,
            'donor_name' => $d->donor_name ?: 'Anonymous',
            'contribution_type' => $d->contribution_type ?: 'love_offering',
            'amount' => (float) $d->amount,
            'denomination_breakdown' => $d->denomination_breakdown ?: [],
            'donation_date' => $d->donation_date?->format('Y-m-d'),
            'notes' => $d->notes,
            'status' => $d->status,
            'recorded_by' => $d->recordedBy?->full_name,
            'received_by' => $d->receivedBy?->full_name,
            'received_at' => $d->received_at?->toIso8601String(),
            'reject_reason' => $d->reject_reason,
            'created_at' => $d->created_at?->toIso8601String(),
        ];
    }

    private function transformIntention(SpecialIntention $row): array
    {
        return [
            'intention_id' => $row->intention_id,
            'parishioner_name' => $row->parishioner_name,
            'intention_text' => $row->intention_text,
            'amount' => (float) $row->amount,
            'denomination_breakdown' => $row->denomination_breakdown ?: [],
            'intention_date' => $row->intention_date?->format('Y-m-d'),
            'notes' => $row->notes,
            'source' => $row->source ?: 'secretary',
            'status' => $row->status,
            'recorded_by' => $row->recordedBy?->full_name,
            'received_by' => $row->receivedBy?->full_name,
            'received_at' => $row->received_at?->toIso8601String(),
            'reject_reason' => $row->reject_reason,
            'created_at' => $row->created_at?->toIso8601String(),
        ];
    }
}
