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
            $table->string('service_type', 100);
            $table->string('description', 255)->nullable();
            $table->string('icon', 50)->nullable();
            $table->string('category', 30)->default('service');
            $table->string('form_handler', 50)->default('generic');
            $table->decimal('fee', 10, 2)->default(0);
            $table->integer('available_slots')->default(0);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_system')->default(false);
            $table->timestamps();

            $table->index('is_active');
            $table->index('category');
        });
    }

    public function down(): void
    {   
        Schema::dropIfExists('church_services');
    }
};