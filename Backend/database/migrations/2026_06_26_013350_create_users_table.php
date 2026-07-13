<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id('user_id');
            
            $table->string('first_name', 50);
            $table->string('middle_name', 50)->nullable();
            $table->string('last_name', 50);
            $table->string('contact_number', 20)->nullable();
            $table->text('address')->nullable();
            
            $table->string('email', 100)->unique()->nullable();
            $table->string('username', 50)->unique()->nullable();
            $table->string('password');
            
            $table->enum('role', ['secretary', 'cashier', 'priest', 'parishioner'])
                  ->default('parishioner');

            $table->boolean('is_active')->default(true);
            
            $table->timestamp('last_login')->nullable();
            $table->timestamps();
            
            $table->index('role');
            $table->index('email');
            $table->index('username');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};