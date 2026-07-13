<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('godparents', function (Blueprint $table) {
            $table->id('godparent_id');
            $table->foreignId('baptism_id')
                  ->constrained('baptism_forms', 'baptism_id')
                  ->onDelete('cascade');
            $table->string('godparent_name', 100);
            $table->enum('relationship', ['godfather', 'godmother']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('godparents');
    }
};