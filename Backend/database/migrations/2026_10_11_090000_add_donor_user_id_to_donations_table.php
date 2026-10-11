<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Additive only: links a donation to the registered parishioner who gave it. Existing donations keep their donor names.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('donations') || Schema::hasColumn('donations', 'donor_user_id')) {
            return;
        }

        Schema::table('donations', function (Blueprint $table) {
            $table->foreignId('donor_user_id')
                ->nullable()
                ->after('donor_name')
                ->constrained('users', 'user_id')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (!Schema::hasColumn('donations', 'donor_user_id')) {
            return;
        }

        Schema::table('donations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('donor_user_id');
        });
    }
};
