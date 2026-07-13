<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mass_collections', function (Blueprint $table) {
            $table->id('collection_id');

            $table->date('mass_date');
            $table->string('mass_type')->default('Sunday Mass');
            $table->time('mass_time')->nullable();
            $table->decimal('amount', 10, 2);
            $table->json('denomination_breakdown')->nullable();

            $table->foreignId('recorded_by')
                ->constrained('users', 'user_id')
                ->onDelete('cascade');

            $table->text('notes')->nullable();

            $table->enum('status', ['pending', 'received', 'rejected'])->default('pending');

            $table->foreignId('received_by')
                ->nullable()
                ->constrained('users', 'user_id')
                ->onDelete('set null');

            $table->timestamp('received_at')->nullable();
            $table->text('reject_reason')->nullable();

            $table->timestamps();

            $table->index('mass_date');
            $table->index('recorded_by');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mass_collections');
    }
};
