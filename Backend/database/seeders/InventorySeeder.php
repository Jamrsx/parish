<?php

namespace Database\Seeders;

use App\Models\Inventory;
use Illuminate\Database\Seeder;

class InventorySeeder extends Seeder
{
    public function run(): void
    {
        $created = Inventory::ensureBuiltinCatalog();
        $this->command?->info("Parish inventory catalog ready. New rows: {$created}");
    }
}
