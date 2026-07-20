<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('donations', function (Blueprint $table) {
            $table->id('donation_id');

            $table->string('donor_name')->nullable();
            /** donation = gift to the church; love_offering = love offering (distinct categories) */
            $table->enum('contribution_type', ['donation', 'love_offering'])->default('love_offering');
            $table->decimal('amount', 10, 2);
            $table->json('denomination_breakdown')->nullable();
            $table->date('donation_date');
            $table->text('notes')->nullable();

            $table->foreignId('recorded_by')
                ->constrained('users', 'user_id')
                ->onDelete('cascade');

            $table->enum('status', ['pending', 'received', 'rejected'])->default('pending');

            $table->foreignId('received_by')
                ->nullable()
                ->constrained('users', 'user_id')
                ->onDelete('set null');

            $table->timestamp('received_at')->nullable();
            $table->text('reject_reason')->nullable();

            $table->timestamps();

            $table->index('status');
            $table->index('donation_date');
            $table->index('recorded_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('donations');
    }
};
