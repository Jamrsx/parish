<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('borrow_records', function (Blueprint $table) {
            $table->id('borrow_record_id');
            
            // Foreign key to inventory
            $table->foreignId('inventory_id')
                  ->constrained('inventory', 'inventory_id')
                  ->onDelete('cascade');
            
            // Borrower information
            $table->string('borrower_name');
            $table->string('borrower_phone')->nullable();
            
            // Borrow details
            $table->integer('quantity_borrowed')->default(1);
            $table->string('location')->nullable();
            
            // Dates
            $table->date('borrowed_at');
            $table->date('expected_return_date');
            $table->date('actual_return_date')->nullable();
            
            // Status
            $table->enum('status', ['borrowed', 'overdue', 'returned'])->default('borrowed');
            
            $table->timestamps();
            
        });
    }

    public function down()
    {
        Schema::dropIfExists('borrow_records');
    }
};