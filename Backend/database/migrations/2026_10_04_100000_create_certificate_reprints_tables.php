<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Additive only: every step checks first, so it is safe to run on a database that already has data.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('app_settings')) {
            Schema::create('app_settings', function (Blueprint $table) {
                $table->id('setting_id');
                $table->string('key', 100)->unique();
                $table->text('value')->nullable();
                $table->foreignId('updated_by')
                    ->nullable()
                    ->constrained('users', 'user_id')
                    ->nullOnDelete();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('certificate_reprints')) {
            Schema::create('certificate_reprints', function (Blueprint $table) {
                $table->id('reprint_id');

                $table->foreignId('issued_certificate_id')
                    ->nullable()
                    ->constrained('issued_certificates', 'issued_certificate_id')
                    ->nullOnDelete();

                $table->string('person_name', 150);
                $table->string('certificate_type', 30)->default('baptismal');
                $table->decimal('amount', 10, 2);
                $table->string('reason', 255)->nullable();

                $table->enum('status', ['awaiting_payment', 'paid', 'released', 'cancelled'])
                    ->default('awaiting_payment');

                $table->foreignId('requested_by')
                    ->nullable()
                    ->constrained('users', 'user_id')
                    ->nullOnDelete();

                $table->foreignId('paid_by')
                    ->nullable()
                    ->constrained('users', 'user_id')
                    ->nullOnDelete();
                $table->timestamp('paid_at')->nullable();
                $table->string('or_number', 50)->nullable();
                $table->text('payment_notes')->nullable();

                $table->foreignId('released_by')
                    ->nullable()
                    ->constrained('users', 'user_id')
                    ->nullOnDelete();
                $table->timestamp('released_at')->nullable();

                $table->foreignId('cancelled_by')
                    ->nullable()
                    ->constrained('users', 'user_id')
                    ->nullOnDelete();
                $table->timestamp('cancelled_at')->nullable();
                $table->string('cancel_reason', 255)->nullable();

                $table->timestamps();

                $table->index('status');
                $table->index('paid_at');
                $table->index('person_name');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('certificate_reprints');
        Schema::dropIfExists('app_settings');
    }
};
