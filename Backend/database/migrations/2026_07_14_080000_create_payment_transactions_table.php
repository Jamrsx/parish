<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_transactions', function (Blueprint $table) {
            $table->id('payment_id');

            $table->foreignId('request_id')
                ->constrained('manage_requests', 'request_id')
                ->onDelete('cascade');

            $table->foreignId('received_by')
                ->constrained('users', 'user_id')
                ->onDelete('cascade');

            $table->decimal('amount', 10, 2);
            $table->string('or_number')->nullable();
            $table->text('notes')->nullable();

            $table->timestamps();

            $table->index('request_id');
            $table->index('received_by');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_transactions');
    }
};
