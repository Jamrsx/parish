<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('inventory', function (Blueprint $table) {
            $table->id('inventory_id');
            $table->string('name');
            $table->enum('category', ['sacristy', 'church', 'office_supply', 'office_equipment'])->nullable();
            $table->enum('type', ['item', 'consumable'])->default('item');
            $table->integer('quantity')->default(0);
            $table->boolean('is_borrowable')->default(false);
            
            $table->timestamps();
            
            $table->index(['type', 'is_borrowable']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('inventory');
    }
};