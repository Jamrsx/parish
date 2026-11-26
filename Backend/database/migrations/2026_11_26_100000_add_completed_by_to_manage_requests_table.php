<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Additive only: records who marked a service as completed (the secretary or the assigned priest).
 * Existing completed services are filled in from the activity log when it has the user; otherwise left empty.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('manage_requests') || Schema::hasColumn('manage_requests', 'completed_by')) {
            return;
        }

        Schema::table('manage_requests', function (Blueprint $table) {
            $table->foreignId('completed_by')
                ->nullable()
                ->after('completed_at')
                ->constrained('users', 'user_id')
                ->nullOnDelete();
        });

        if (!Schema::hasTable('activity_logs')) {
            return;
        }

        // Best-effort backfill: the latest "marked done" log entry that has a user
        $logs = DB::table('activity_logs')
            ->where('subject_type', 'request')
            ->where('action', 'status_changed')
            ->whereNotNull('user_id')
            ->whereNotNull('request_id')
            ->where(fn ($q) => $q->where('changes', 'like', '%"to":"done"%')->orWhere('changes', 'like', '%"to": "done"%'))
            ->orderBy('log_id')
            ->get(['request_id', 'user_id']);

        foreach ($logs as $log) {
            DB::table('manage_requests')
                ->where('request_id', $log->request_id)
                ->where('status', 'done')
                ->whereNull('completed_by')
                ->whereExists(fn ($q) => $q->select(DB::raw(1))->from('users')->where('users.user_id', $log->user_id))
                ->update(['completed_by' => $log->user_id]);
        }
    }

    public function down(): void
    {
        if (!Schema::hasColumn('manage_requests', 'completed_by')) {
            return;
        }

        Schema::table('manage_requests', function (Blueprint $table) {
            $table->dropConstrainedForeignId('completed_by');
        });
    }
};
