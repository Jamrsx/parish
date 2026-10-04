<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

/**
 * Church / archdiocese income sharing ratio (default 60% / 40%).
 */
class IncomeSharingController extends Controller
{
    public function show()
    {
        return response()->json([
            'success' => true,
            'data' => $this->payload(),
        ]);
    }

    public function update(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'church_percent' => 'required|integer|min:1|max:99',
        ], [
            'church_percent.required' => 'Enter the church share percentage.',
            'church_percent.integer' => 'Use a whole number for the church share (e.g. 60).',
            'church_percent.min' => 'The church share must be at least 1%.',
            'church_percent.max' => 'The church share cannot be more than 99%.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        /** @var User $user */
        $user = $request->user();
        $previous = AppSetting::churchSharePercent();
        $percent = (int) $request->church_percent;

        AppSetting::setValue(AppSetting::INCOME_SHARE_CHURCH_PERCENT, $percent, $user->user_id);

        Log::info('Income sharing ratio updated', [
            'from' => $previous . '/' . (100 - $previous),
            'to' => $percent . '/' . (100 - $percent),
            'by' => $user->user_id,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Sharing ratio saved and locked at {$percent}% church / " . (100 - $percent) . '% archdiocese.',
            'data' => $this->payload(),
        ]);
    }

    private function payload(): array
    {
        $row = AppSetting::with('updatedBy:user_id,first_name,middle_name,last_name')
            ->where('key', AppSetting::INCOME_SHARE_CHURCH_PERCENT)
            ->first();
        $percent = AppSetting::churchSharePercent();

        return [
            'church_percent' => $percent,
            'archdiocese_percent' => 100 - $percent,
            'is_default' => $row === null,
            'updated_at' => $row?->updated_at?->toIso8601String(),
            'updated_by' => $row?->updatedBy ? trim($row->updatedBy->full_name) : null,
        ];
    }
}
