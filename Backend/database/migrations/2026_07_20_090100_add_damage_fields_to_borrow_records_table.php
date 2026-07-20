<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Safe additive migration — does not drop tables or clear data.
     */
    public function up(): void
    {
        Schema::table('borrow_records', function (Blueprint $table) {
            if (!Schema::hasColumn('borrow_records', 'quantity_damaged')) {
                $table->unsignedInteger('quantity_damaged')->default(0)->after('quantity_borrowed');
            }
            if (!Schema::hasColumn('borrow_records', 'damage_notes')) {
                $table->text('damage_notes')->nullable()->after('quantity_damaged');
            }
        });
    }

    public function down(): void
    {
        Schema::table('borrow_records', function (Blueprint $table) {
            if (Schema::hasColumn('borrow_records', 'damage_notes')) {
                $table->dropColumn('damage_notes');
            }
            if (Schema::hasColumn('borrow_records', 'quantity_damaged')) {
                $table->dropColumn('quantity_damaged');
            }
        });
    }
};
