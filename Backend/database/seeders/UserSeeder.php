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
            'first_name' => 'Geildan',
            'middle_name' => 'O',
            'last_name' => 'Lozada',
            'contact_number' => '09123456784',
            'username' => 'secretary',
            'email' => 'lozada123@gmail.com',
            'password' => 'password123',
            'role' => 'secretary',
        ]);

        // Create Cashier
        User::create([
            'first_name' => 'Jane',
            'middle_name' => 'L',
            'last_name' => 'Smith',
            'contact_number' => '09123456781',
            'username' => 'cashier',
            'email' => 'jane@gmail.com',
            'password' => 'password123',
            'role' => 'cashier',
        ]);

        // Create Priests
        User::create([
            'first_name' => 'Juan',
            'middle_name' => 'M',
            'last_name' => 'Dela Cruz',
            'contact_number' => '09123456789',
            'email' => 'juan@gmail.com',
            'password' => 'password123',
            'role' => 'priest',
        ]);

        User::create([
            'first_name' => 'Pedro',
            'middle_name' => 'S',
            'last_name' => 'Santos',
            'contact_number' => '09123456788',
            'email' => 'pedro@gmail.com',
            'password' => 'password123',
            'role' => 'priest',
        ]);

        // Create Parishioners
        User::create([
            'first_name' => 'Maria',
            'middle_name' => 'D',
            'last_name' => 'Santos',
            'contact_number' => '09123456787',
            'address' => 'Igpit',
            'email' => 'maria@gmail.com',
            'password' => 'password123',
            'role' => 'parishioner',
        ]);

        User::create([
            'first_name' => 'Jose',
            'middle_name' => 'E',
            'last_name' => 'Reyes',
            'contact_number' => '09123456786',
            'address' => 'Igpit',
            'email' => 'jose@gmail.com',
            'password' => 'password123',
            'role' => 'parishioner',
        ]);
    }
}
