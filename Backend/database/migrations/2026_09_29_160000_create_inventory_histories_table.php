<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Additive only: creates inventory_histories and seeds it from existing borrow_records.
 * Never modifies or deletes existing inventory / borrow data.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('inventory_histories')) {
            return;
        }

        Schema::create('inventory_histories', function (Blueprint $table) {
            $table->id('history_id');

            $table->foreignId('inventory_id')
                ->nullable()
                ->constrained('inventory', 'inventory_id')
                ->nullOnDelete();
            /** Snapshot so history stays readable after rename/delete */
            $table->string('item_name', 255);

            /** created | stock_in | stock_out | borrowed | returned | returned_damaged | edited | deleted */
            $table->string('action', 30);
            $table->integer('quantity_change')->default(0);
            $table->integer('quantity_before')->nullable();
            $table->integer('quantity_after')->nullable();

            $table->foreignId('borrow_record_id')
                ->nullable()
                ->constrained('borrow_records', 'borrow_record_id')
                ->nullOnDelete();

            $table->json('details')->nullable();
            $table->text('notes')->nullable();

            $table->foreignId('performed_by')
                ->nullable()
                ->constrained('users', 'user_id')
                ->nullOnDelete();
            $table->timestamp('occurred_at');

            $table->timestamps();

            $table->index(['inventory_id', 'occurred_at']);
            $table->index(['action', 'occurred_at']);
            $table->index('occurred_at');
        });

        $this->backfillFromBorrowRecords();
    }

    private function backfillFromBorrowRecords(): void
    {
        if (!Schema::hasTable('borrow_records') || DB::table('inventory_histories')->exists()) {
            return;
        }

        $records = DB::table('borrow_records')
            ->leftJoin('inventory', 'inventory.inventory_id', '=', 'borrow_records.inventory_id')
            ->select('borrow_records.*', 'inventory.name as item_name')
            ->orderBy('borrow_records.borrow_record_id')
            ->get();

        $now = now();
        $rows = [];

        foreach ($records as $record) {
            $name = $record->item_name ?: 'Unknown item';
            $borrowed = (int) $record->quantity_borrowed;
            $borrowedAt = $record->created_at ?: $record->borrowed_at;

            $rows[] = [
                'inventory_id' => $record->inventory_id,
                'item_name' => $name,
                'action' => 'borrowed',
                'quantity_change' => -$borrowed,
                'quantity_before' => null,
                'quantity_after' => null,
                'borrow_record_id' => $record->borrow_record_id,
                'details' => json_encode([
                    'borrower_name' => $record->borrower_name,
                    'borrower_phone' => $record->borrower_phone,
                    'location' => $record->location,
                    'expected_return_date' => $record->expected_return_date,
                    'source' => 'backfill',
                ]),
                'notes' => null,
                'performed_by' => null,
                'occurred_at' => $borrowedAt,
                'created_at' => $now,
                'updated_at' => $now,
            ];

            if ($record->status === 'returned' && $record->actual_return_date) {
                $damaged = (int) ($record->quantity_damaged ?? 0);
                $restored = max(0, $borrowed - $damaged);
                $returnedAt = $record->updated_at
                    && substr((string) $record->updated_at, 0, 10) === substr((string) $record->actual_return_date, 0, 10)
                    ? $record->updated_at
                    : $record->actual_return_date;

                $rows[] = [
                    'inventory_id' => $record->inventory_id,
                    'item_name' => $name,
                    'action' => $damaged > 0 ? 'returned_damaged' : 'returned',
                    'quantity_change' => $restored,
                    'quantity_before' => null,
                    'quantity_after' => null,
                    'borrow_record_id' => $record->borrow_record_id,
                    'details' => json_encode([
                        'borrower_name' => $record->borrower_name,
                        'quantity_borrowed' => $borrowed,
                        'quantity_damaged' => $damaged,
                        'damage_notes' => $record->damage_notes,
                        'source' => 'backfill',
                    ]),
                    'notes' => null,
                    'performed_by' => null,
                    'occurred_at' => $returnedAt,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        foreach (array_chunk($rows, 200) as $chunk) {
            DB::table('inventory_histories')->insert($chunk);
        }

        Log::info('Inventory history backfilled from borrow records', [
            'borrow_records' => $records->count(),
            'history_rows' => count($rows),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_histories');
    }
};
