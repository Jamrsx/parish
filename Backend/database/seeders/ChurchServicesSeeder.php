<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ChurchServicesSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('church_services')->insert([
            [
                'service_type' => 'Baptism',
                'fee' => 500.00,
                'available_slots' => 10, 
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'service_type' => 'Marriage',
                'fee' => 2000.00,
                'available_slots' => 3, 
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'service_type' => 'Funeral Mass',
                'fee' => 1000.00,
                'available_slots' => 5, 
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'service_type' => 'House Blessing',
                'fee' => 300.00,
                'available_slots' => 3, 
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'service_type' => 'Baptismal Certificate',
                'fee' => 100.00,
                'available_slots' => 150, 
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'service_type' => 'Marriage Certificate',
                'fee' => 100.00,
                'available_slots' => 150, 
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }
}