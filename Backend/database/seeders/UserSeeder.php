<?php

namespace Database\Seeders;

//use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\User;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
       // Create Secretary
        User::create([
            'first_name' => 'Secretary',
            'middle_name' => 'S.',
            'last_name' => 'Sec',
            'contact_number' => '09123456784',
            'username' => 'secretary',
            'email' => 'sec@gmail.com',
            'password' => 'password123',
            'role' => 'secretary',
        ]);

        // Create Cashier
        User::create([
            'first_name' => 'Cashier',
            'middle_name' => 'L',
            'last_name' => 'Cash',
            'contact_number' => '09123456781',
            'username' => 'cashier',
            'email' => 'cashier@gmail.com',
            'password' => 'password123',
            'role' => 'cashier',
        ]);

        // Create Priests
        User::create([
            'first_name' => 'Priest1',
            'middle_name' => 'P',
            'last_name' => 'Dela Cruz',
            'contact_number' => '09123456789',
            'email' => 'priest@gmail.com',
            'password' => 'password123',
            'role' => 'priest',
        ]);

        User::create([
            'first_name' => 'Priest2',
            'middle_name' => 'S',
            'last_name' => 'Santos',
            'contact_number' => '09123456788',
            'email' => 'Priest2@gmail.com',
            'password' => 'password123',
            'role' => 'priest',
        ]);

        // Create Parishioners
        // User::create([
        //     'first_name' => 'Maria',
        //     'middle_name' => 'D',
        //     'last_name' => 'Santos',
        //     'contact_number' => '09123456787',
        //     'address' => 'Igpit',
        //     'email' => 'maria@gmail.com',
        //     'password' => 'password123',
        //     'role' => 'parishioner',
        // ]);

        // User::create([
        //     'first_name' => 'Jose',
        //     'middle_name' => 'E',
        //     'last_name' => 'Reyes',
        //     'contact_number' => '09123456786',
        //     'address' => 'Igpit',
        //     'email' => 'jose@gmail.com',
        //     'password' => 'password123',
        //     'role' => 'parishioner',
        // ]);
    }
}
