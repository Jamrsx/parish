<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Additive only: every step checks first, so it is safe to run on a database that already has data.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('priest_time_off')) {
            Schema::create('priest_time_off', function (Blueprint $table) {
                $table->id('time_off_id');
                $table->foreignId('priest_id')
                    ->constrained('users', 'user_id')
                    ->cascadeOnDelete();
                $table->date('start_date');
                $table->date('end_date');
                // Both null = whole day(s); otherwise the hours apply on every day in the range
                $table->string('start_time', 5)->nullable();
                $table->string('end_time', 5)->nullable();
                $table->string('reason', 255)->nullable();
                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users', 'user_id')
                    ->nullOnDelete();
                $table->timestamps();

                $table->index(['priest_id', 'start_date', 'end_date']);
            });
        }

        if (Schema::hasTable('users') && !Schema::hasColumn('users', 'unavailable_until')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dateTime('unavailable_until')->nullable()->after('is_available');
            });
        }

        // Time-off notices to a priest are not tied to a request, so request_id must allow NULL.
        // Existing rows are untouched; only the column definition changes.
        if (
            Schema::hasTable('notifications')
            && Schema::hasColumn('notifications', 'request_id')
            && DB::getDriverName() === 'mysql'
        ) {
            $column = DB::selectOne(
                "SELECT IS_NULLABLE FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'request_id'"
            );

            if ($column && $column->IS_NULLABLE === 'NO') {
                DB::statement('ALTER TABLE notifications MODIFY request_id BIGINT UNSIGNED NULL');
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('users') && Schema::hasColumn('users', 'unavailable_until')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('unavailable_until');
            });
        }

        Schema::dropIfExists('priest_time_off');
    }
};
