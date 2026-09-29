<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('church_expenses')) {
            return;
        }

        Schema::create('church_expenses', function (Blueprint $table) {
            $table->id('expense_id');

            /** water_bill | electricity_bill | office_supply | maintenance | manpower | fuel | kitchen_supplies | allowance */
            $table->string('category', 40);
            $table->string('description', 255);
            /** Supplier, worker, scholar, or vehicle/equipment depending on category */
            $table->string('payee_name', 150)->nullable();
            $table->decimal('amount', 12, 2);
            $table->date('expense_date');
            /** YYYY-MM covered by a utility bill (water / electricity) */
            $table->string('billing_period', 7)->nullable();
            $table->string('reference_no', 100)->nullable();
            $table->text('notes')->nullable();

            /** draft → forwarded → verified | returned (returned can be edited and forwarded again) */
            $table->enum('status', ['draft', 'forwarded', 'verified', 'returned'])->default('draft');

            $table->foreignId('recorded_by')
                ->nullable()
                ->constrained('users', 'user_id')
                ->nullOnDelete();
            $table->timestamp('forwarded_at')->nullable();

            $table->foreignId('reviewed_by')
                ->nullable()
                ->constrained('users', 'user_id')
                ->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('return_reason')->nullable();

            $table->timestamps();

            $table->index('category');
            $table->index('status');
            $table->index('expense_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('church_expenses');
    }
};
