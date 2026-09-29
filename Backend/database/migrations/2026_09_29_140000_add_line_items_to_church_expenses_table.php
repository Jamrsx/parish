<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('church_expenses') || Schema::hasColumn('church_expenses', 'line_items')) {
            return;
        }

        Schema::table('church_expenses', function (Blueprint $table) {
            /** Itemized rows for manpower / allowance (name, amount) and supplies (name, quantity, unit_price, total) */
            $table->json('line_items')->nullable()->after('amount');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('church_expenses', 'line_items')) {
            Schema::table('church_expenses', function (Blueprint $table) {
                $table->dropColumn('line_items');
            });
        }
    }
};
