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
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class SecretaryDashboardController extends Controller
{
    /**
     * Monthly parish activity + income share by service (secretary overview).
     */
    public function monthlyOverview(Request $request)
    {
        /** @var User|null $user */
        $user = $request->user();
        if (!$user || (!$user->isSecretary() && !$user->isCashier())) {
            return response()->json([
                'success' => false,
                'message' => 'Only the secretary or cashier can view the monthly overview.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'year' => 'nullable|integer|min:2020|max:2100',
            'month' => 'nullable|integer|min:1|max:12',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $now = Carbon::now();
        $year = (int) ($request->input('year') ?: $now->year);
        $month = (int) ($request->input('month') ?: $now->month);
        $start = Carbon::create($year, $month, 1)->startOfDay();
        $end = $start->copy()->endOfMonth();

        $requests = ManageRequest::with('service')
            ->whereBetween('created_at', [$start, $end])
            ->get();

        $activityByStatus = [
            'pending' => $requests->where('status', 'pending')->count(),
            'approved' => $requests->where('status', 'approved')->count(),
            'done' => $requests->where('status', 'done')->count(),
            'cancelled' => $requests->where('status', 'cancelled')->count(),
        ];

        $activityByService = [];
        foreach ($requests as $row) {
            $label = $row->service?->service_type ?: 'Other';
            if (!isset($activityByService[$label])) {
                $activityByService[$label] = [
                    'service_type' => $label,
                    'request_count' => 0,
                    'completed_count' => 0,
                ];
            }
            $activityByService[$label]['request_count']++;
            if ($row->status === 'done') {
                $activityByService[$label]['completed_count']++;
            }
        }

        $payments = PaymentTransaction::with('request.service')
            ->whereBetween('created_at', [$start, $end])
            ->get();

        $incomeByService = [];
        foreach ($payments as $payment) {
            $label = $payment->request?->service?->service_type ?: 'Other';
            if (!isset($incomeByService[$label])) {
                $incomeByService[$label] = [
                    'service_type' => $label,
                    'amount' => 0.0,
                    'payment_count' => 0,
                ];
            }
            $incomeByService[$label]['amount'] += (float) $payment->amount;
            $incomeByService[$label]['payment_count']++;
        }

        $serviceFeesTotal = (float) $payments->sum('amount');
        $massTotal = (float) MassCollection::received()
            ->whereBetween('received_at', [$start, $end])
            ->sum('amount');
        $donationTotal = (float) Donation::received()
            ->whereBetween('received_at', [$start, $end])
            ->sum('amount');
        $intentionTotal = (float) SpecialIntention::received()
            ->whereBetween('received_at', [$start, $end])
            ->sum('amount');

        $otherIncome = [
            [
                'label' => 'Mass Collections',
                'amount' => $massTotal,
            ],
            [
                'label' => 'Donations',
                'amount' => $donationTotal,
            ],
            [
                'label' => 'Special Intentions',
                'amount' => $intentionTotal,
            ],
        ];

        $totalIncome = $serviceFeesTotal + $massTotal + $donationTotal + $intentionTotal;

        $incomeShare = collect($incomeByService)
            ->map(function ($row) use ($serviceFeesTotal) {
                $amount = round((float) $row['amount'], 2);
                return [
                    'service_type' => $row['service_type'],
                    'amount' => $amount,
                    'payment_count' => (int) $row['payment_count'],
                    'percentage' => $serviceFeesTotal > 0
                        ? round(($amount / $serviceFeesTotal) * 100, 1)
                        : 0.0,
                ];
            })
            ->sortByDesc('amount')
            ->values()
            ->all();

        $activityShare = collect($activityByService)
            ->map(function ($row) use ($requests) {
                $count = (int) $row['request_count'];
                $total = $requests->count();
                return [
                    'service_type' => $row['service_type'],
                    'request_count' => $count,
                    'completed_count' => (int) $row['completed_count'],
                    'percentage' => $total > 0 ? round(($count / $total) * 100, 1) : 0.0,
                ];
            })
            ->sortByDesc('request_count')
            ->values()
            ->all();

        $unpaidCount = ManageRequest::query()
            ->whereIn('status', ['approved', 'done'])
            ->whereIn('payment_status', ['unpaid', 'partial'])
            ->whereBetween('created_at', [$start, $end])
            ->whereDoesntHave('service', function ($q) {
                $q->where('form_handler', 'special_intention')
                    ->orWhere('service_type', 'Special Intention');
            })
            ->count();

        $payload = [
            'year' => $year,
            'month' => $month,
            'month_label' => $start->format('F Y'),
            'period' => [
                'start' => $start->toDateString(),
                'end' => $end->toDateString(),
            ],
            'summary' => [
                'total_requests' => $requests->count(),
                'pending' => $activityByStatus['pending'],
                'approved' => $activityByStatus['approved'],
                'completed' => $activityByStatus['done'],
                'cancelled' => $activityByStatus['cancelled'],
                'unpaid_requests' => $unpaidCount,
                'service_fees_total' => round($serviceFeesTotal, 2),
                'mass_collections_total' => round($massTotal, 2),
                'donations_total' => round($donationTotal, 2),
                'special_intentions_total' => round($intentionTotal, 2),
                'total_income' => round($totalIncome, 2),
            ],
            'activity_by_service' => $activityShare,
            'income_by_service' => $incomeShare,
            'other_income' => array_map(function ($row) use ($totalIncome) {
                $amount = round((float) $row['amount'], 2);
                return [
                    'label' => $row['label'],
                    'amount' => $amount,
                    'percentage' => $totalIncome > 0
                        ? round(($amount / $totalIncome) * 100, 1)
                        : 0.0,
                ];
            }, $otherIncome),
        ];

        Log::info('Secretary monthly overview loaded', [
            'year' => $year,
            'month' => $month,
            'total_requests' => $payload['summary']['total_requests'],
            'total_income' => $payload['summary']['total_income'],
            'secretary_id' => $user->user_id,
        ]);

        return response()->json([
            'success' => true,
            'data' => $payload,
        ]);
    }
}
