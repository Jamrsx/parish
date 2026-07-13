<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class InventorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $items = [
            // Sacristy Items
            ['name' => 'Crucifix', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 5, 'is_borrowable' => false],
            ['name' => 'Paten', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 3, 'is_borrowable' => false],
            ['name' => 'Chalice', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 3, 'is_borrowable' => false],
            ['name' => 'Ciborium', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 2, 'is_borrowable' => false],
            ['name' => 'Pal', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 5, 'is_borrowable' => false],
            ['name' => 'Lavabo Bowl', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 2, 'is_borrowable' => false],
            ['name' => 'Monstrance', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 1, 'is_borrowable' => false],
            ['name' => 'Thurible', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 2, 'is_borrowable' => false],
            ['name' => 'Incense Boat', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 2, 'is_borrowable' => false],
            ['name' => 'Bells', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 2, 'is_borrowable' => false],
            ['name' => 'Candle', 'category' => 'sacristy', 'type' => 'consumable', 'quantity' => 50, 'is_borrowable' => false],
            ['name' => 'Lighter', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 5, 'is_borrowable' => false],
            ['name' => 'Cruets', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 4, 'is_borrowable' => false],
            ['name' => 'Credence Table', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 1, 'is_borrowable' => false],
            ['name' => 'Magic Charcoal', 'category' => 'sacristy', 'type' => 'consumable', 'quantity' => 20, 'is_borrowable' => false],
            ['name' => 'Offering Basket', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 3, 'is_borrowable' => false],
            ['name' => 'Roman Missal', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 2, 'is_borrowable' => false],
            ['name' => 'Lectionary', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 2, 'is_borrowable' => false],
            ['name' => 'Ritual for Priest', 'category' => 'sacristy', 'type' => 'item', 'quantity' => 2, 'is_borrowable' => false],
            ['name' => 'Missalette', 'category' => 'sacristy', 'type' => 'consumable', 'quantity' => 30, 'is_borrowable' => false],

            // Church Items
            ['name' => 'Chairs', 'category' => 'church', 'type' => 'item', 'quantity' => 100, 'is_borrowable' => true],
            ['name' => 'Foldable Table', 'category' => 'church', 'type' => 'item', 'quantity' => 10, 'is_borrowable' => true],
            ['name' => 'Portable Speaker', 'category' => 'church', 'type' => 'item', 'quantity' => 2, 'is_borrowable' => true],
            ['name' => 'Stand Fan', 'category' => 'church', 'type' => 'item', 'quantity' => 5, 'is_borrowable' => true],

            // Office Supply
            ['name' => 'Wine', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 20, 'is_borrowable' => false],
            ['name' => 'Host', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 200, 'is_borrowable' => false],
            ['name' => 'Incense Powder', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 10, 'is_borrowable' => false],
            ['name' => 'Chrism Oil', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 5, 'is_borrowable' => false],
            ['name' => 'Oleum Infirmorum', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 3, 'is_borrowable' => false],
            ['name' => 'Holy Water', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 15, 'is_borrowable' => false],
            ['name' => 'Purificator', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 30, 'is_borrowable' => false],
            ['name' => 'Corporal', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 20, 'is_borrowable' => false],
            ['name' => 'Bond Paper', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 500, 'is_borrowable' => false],
            ['name' => 'Ink', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 10, 'is_borrowable' => false],
            ['name' => 'Mass Intention Envelope', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 100, 'is_borrowable' => false],
            ['name' => 'Battery', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 50, 'is_borrowable' => false],
            ['name' => 'Pen', 'category' => 'office_supply', 'type' => 'consumable', 'quantity' => 30, 'is_borrowable' => false],

            // Office Equipment
            ['name' => 'Desktop Computer', 'category' => 'office_equipment', 'type' => 'item', 'quantity' => 3, 'is_borrowable' => false],
            ['name' => 'Printer', 'category' => 'office_equipment', 'type' => 'item', 'quantity' => 2, 'is_borrowable' => false],
            ['name' => 'Filing Cabinet', 'category' => 'office_equipment', 'type' => 'item', 'quantity' => 4, 'is_borrowable' => false],
            ['name' => 'Projector', 'category' => 'office_equipment', 'type' => 'item', 'quantity' => 1, 'is_borrowable' => false],
            ['name' => 'Chairs', 'category' => 'office_equipment', 'type' => 'item', 'quantity' => 15, 'is_borrowable' => false],
            ['name' => 'Tables', 'category' => 'office_equipment', 'type' => 'item', 'quantity' => 5, 'is_borrowable' => false],
        ];

        // Add timestamps to all items
        $items = array_map(function ($item) {
            return array_merge($item, [
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }, $items);

        DB::table('inventory')->insert($items);
    }
}