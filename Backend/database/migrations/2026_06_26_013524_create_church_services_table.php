<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('church_services', function (Blueprint $table) {
            $table->id('service_id');
            $table->string('service_type', 50);
            $table->decimal('fee', 10, 2)->default(0);
            $table->integer('available_slots')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {   
        Schema::dropIfExists('church_services');
    }
};