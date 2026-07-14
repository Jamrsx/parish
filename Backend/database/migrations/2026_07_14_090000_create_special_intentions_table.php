<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('special_intentions', function (Blueprint $table) {
            $table->id('intention_id');

            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users', 'user_id')
                ->onDelete('set null');

            $table->foreignId('request_id')
                ->nullable()
                ->constrained('manage_requests', 'request_id')
                ->onDelete('set null');

            $table->string('parishioner_name');
            $table->text('intention_text');
            $table->decimal('amount', 10, 2);
            $table->json('denomination_breakdown')->nullable();
            $table->date('intention_date');
            $table->text('notes')->nullable();
            $table->string('source', 20)->default('secretary');

            $table->foreignId('recorded_by')
                ->nullable()
                ->constrained('users', 'user_id')
                ->onDelete('set null');

            $table->enum('status', ['pending', 'approved', 'received', 'rejected'])->default('pending');

            $table->foreignId('received_by')
                ->nullable()
                ->constrained('users', 'user_id')
                ->onDelete('set null');

            $table->timestamp('received_at')->nullable();
            $table->text('reject_reason')->nullable();

            $table->timestamps();

            $table->index('status');
            $table->index('intention_date');
            $table->index('recorded_by');
            $table->index('user_id');
            $table->index('source');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('special_intentions');
    }
};
