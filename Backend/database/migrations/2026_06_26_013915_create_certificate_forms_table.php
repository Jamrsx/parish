<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certificate_forms', function (Blueprint $table) {
            $table->id('certificate_id');
            
            $table->foreignId('service_id')
                  ->nullable()
                  ->constrained('church_services', 'service_id')
                  ->onDelete('set null');
            
            
            $table->string('full_name', 100);
            $table->date('birth_date')->nullable();  
            $table->date('marriage_date')->nullable();  
            $table->text('address');
            $table->string('contact_number', 20);
            
            $table->date('preferred_date');
            $table->time('preferred_time');
            
            $table->timestamps();

        });
    }

    public function down(): void
    {
        Schema::dropIfExists('certificate_forms');
    }
};