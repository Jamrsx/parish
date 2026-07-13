<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_forms', function (Blueprint $table) {
            $table->id('serviceform_id');
            
            $table->foreignId('service_id')
                  ->constrained('church_services', 'service_id')
                  ->onDelete('cascade');
            
            $table->string('full_name', 100);
            $table->text('address');
            $table->string('contact_number', 20);
            
            $table->date('preferred_date');
            $table->time('preferred_time');
            
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_forms');
    }
};