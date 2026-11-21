<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('expense_categories')) {
            return;
        }

        /** Custom categories added by the secretary; built-in ones stay in ChurchExpense::CATEGORIES */
        Schema::create('expense_categories', function (Blueprint $table) {
            $table->id('expense_category_id');
            /** Stored in church_expenses.category */
            $table->string('value', 40)->unique();
            $table->string('label', 30)->unique();
            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users', 'user_id')
                ->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expense_categories');
    }
};
