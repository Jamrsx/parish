<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('manage_requests', function (Blueprint $table) {
            $table->id('request_id');
            
            $table->foreignId('user_id')
                  ->constrained('users', 'user_id')
                  ->onDelete('cascade');
            
            $table->foreignId('service_id')
                  ->constrained('church_services', 'service_id')
                  ->onDelete('cascade');
            
            $table->foreignId('processed_by')
                  ->nullable()
                  ->constrained('users', 'user_id')
                  ->onDelete('set null');
            
            $table->foreignId('assigned_priest')
                  ->nullable()
                  ->constrained('users', 'user_id')
                  ->onDelete('set null');
            
            $table->foreignId('baptism_form_id')
                  ->nullable()
                  ->constrained('baptism_forms', 'baptism_id')
                  ->onDelete('set null');
            
            $table->foreignId('service_form_id')
                  ->nullable()
                  ->constrained('service_forms', 'serviceform_id')
                  ->onDelete('set null');
            
            $table->foreignId('certificate_form_id')
                  ->nullable()
                  ->constrained('certificate_forms', 'certificate_id')
                  ->onDelete('set null');
            
            $table->date('preferred_date');
            $table->time('preferred_time');
            
            $table->enum('status', ['pending', 'approved', 'done', 'cancelled'])
                  ->default('pending');
            
            $table->foreignId('cancelled_by')
                  ->nullable()
                  ->constrained('users', 'user_id')
                  ->onDelete('set null');
            $table->text('cancelled_reason')->nullable();
            
            $table->foreignId('rescheduled_by')
                  ->nullable()
                  ->constrained('users', 'user_id')
                  ->onDelete('set null');
            $table->text('reschedule_reason')->nullable();
            
            $table->enum('payment_status', ['unpaid', 'partial', 'paid'])->default('unpaid');
            $table->decimal('amount_paid', 10, 2)->default(0);
            $table->timestamp('payment_date')->nullable();
            
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index('status');
            $table->index('preferred_date');
            $table->index('payment_status');
            $table->index('processed_by');  
            $table->index('assigned_priest');  
            $table->index('cancelled_by');  
            $table->index('rescheduled_by');  
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manage_requests');
    }
};