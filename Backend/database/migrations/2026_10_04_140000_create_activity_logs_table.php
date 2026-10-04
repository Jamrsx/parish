<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Additive only: creates the append-only activity log if it does not exist yet. Existing data is untouched.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('activity_logs')) {
            return;
        }

        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id('log_id');

            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users', 'user_id')
                ->nullOnDelete();
            /** Name and role at the time of the action, kept even if the account changes later */
            $table->string('user_name', 150)->nullable();
            $table->string('user_role', 30)->nullable();

            /** created | updated | status_changed | rescheduled | priest_assigned | paid | deleted */
            $table->string('action', 30);
            /** request | payment | mass_collection | donation | special_intention | expense | reprint | certificate | time_off | setting */
            $table->string('subject_type', 40);
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->unsignedBigInteger('request_id')->nullable();

            $table->string('description', 500);
            $table->json('changes')->nullable();
            $table->decimal('amount', 12, 2)->nullable();
            $table->string('ip_address', 45)->nullable();

            $table->timestamp('created_at')->useCurrent();

            $table->index(['subject_type', 'subject_id']);
            $table->index('request_id');
            $table->index('user_id');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
