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
                'description' => 'Holy Baptism for infants and adults',
                'icon' => 'Droplets',
                'category' => 'service',
                'form_handler' => 'baptism',
                'fee' => 500.00,
                'available_slots' => 10,
                'is_active' => true,
                'is_system' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'service_type' => 'Marriage',
                'description' => 'Holy Matrimony wedding ceremony',
                'icon' => 'Heart',
                'category' => 'service',
                'form_handler' => 'marriage',
                'fee' => 2000.00,
                'available_slots' => 3,
                'is_active' => true,
                'is_system' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'service_type' => 'Funeral Mass',
                'description' => 'Christian burial and memorial service',
                'icon' => 'Cross',
                'category' => 'service',
                'form_handler' => 'funeral_mass',
                'fee' => 1000.00,
                'available_slots' => 5,
                'is_active' => true,
                'is_system' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'service_type' => 'House Blessing',
                'description' => 'Blessing of new home or special occasion',
                'icon' => 'Home',
                'category' => 'service',
                'form_handler' => 'house_blessing',
                'fee' => 300.00,
                'available_slots' => 3,
                'is_active' => true,
                'is_system' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'service_type' => 'Special Intention',
                'description' => 'Prayer intention offering',
                'icon' => 'BookOpen',
                'category' => 'service',
                'form_handler' => 'special_intention',
                'fee' => 500.00,
                'available_slots' => 20,
                'is_active' => true,
                'is_system' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'service_type' => 'Baptismal Certificate',
                'description' => 'Official record of Holy Baptism',
                'icon' => 'FileText',
                'category' => 'certificate',
                'form_handler' => 'baptismal_certificate',
                'fee' => 100.00,
                'available_slots' => 150,
                'is_active' => true,
                'is_system' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'service_type' => 'Marriage Certificate',
                'description' => 'Official record of Holy Matrimony',
                'icon' => 'FileText',
                'category' => 'certificate',
                'form_handler' => 'marriage_certificate',
                'fee' => 100.00,
                'available_slots' => 150,
                'is_active' => true,
                'is_system' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }
}
