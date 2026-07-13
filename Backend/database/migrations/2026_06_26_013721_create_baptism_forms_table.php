<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('baptism_forms', function (Blueprint $table) {
            $table->id('baptism_id');
            
            // Child details
            $table->string('child_first_name', 50);
            $table->string('child_middle_name', 50)->nullable();
            $table->string('child_last_name', 50);
            $table->date('child_birth_date');
            $table->string('child_birth_place', 100)->nullable();
            
            // Mother details
            $table->string('mother_first_name', 50);
            $table->string('mother_middle_name', 50)->nullable();
            $table->string('mother_last_name', 50);
            
            // Father details
            $table->string('father_first_name', 50);
            $table->string('father_middle_name', 50)->nullable();
            $table->string('father_last_name', 50);
            
            // Contact
            $table->text('address');
            $table->string('contact_number', 20);
            
            // Preferred Schedule
            $table->date('preferred_date');
            $table->time('preferred_time');
            
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('baptism_forms');
    }
};