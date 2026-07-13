<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id('notification_id');
            
            $table->foreignId('user_id')  
                  ->constrained('users', 'user_id')
                  ->onDelete('cascade');
            
            $table->foreignId('request_id')
                  ->constrained('manage_requests', 'request_id')
                  ->onDelete('cascade');
            
            $table->string('type');
            $table->string('title');
            $table->text('message');
            $table->enum('status', ['unread', 'read'])->default('unread');
            
            $table->timestamps();
            
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};