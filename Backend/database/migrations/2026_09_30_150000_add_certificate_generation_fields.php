<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Additive only: every step checks first, so it is safe to run on a database that already has data.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('certificate_forms', function (Blueprint $table) {
            if (!Schema::hasColumn('certificate_forms', 'father_name')) {
                $table->string('father_name', 150)->nullable()->after('full_name');
            }
            if (!Schema::hasColumn('certificate_forms', 'mother_name')) {
                $table->string('mother_name', 150)->nullable()->after('father_name');
            }
            if (!Schema::hasColumn('certificate_forms', 'birth_place')) {
                $table->string('birth_place', 150)->nullable()->after('birth_date');
            }
        });

        Schema::table('baptism_forms', function (Blueprint $table) {
            if (!Schema::hasColumn('baptism_forms', 'register_no')) {
                $table->string('register_no', 20)->nullable()->after('child_birth_place');
            }
            if (!Schema::hasColumn('baptism_forms', 'register_page')) {
                $table->string('register_page', 20)->nullable()->after('register_no');
            }
            if (!Schema::hasColumn('baptism_forms', 'register_line')) {
                $table->string('register_line', 20)->nullable()->after('register_page');
            }
        });

        if (!Schema::hasTable('issued_certificates')) {
            Schema::create('issued_certificates', function (Blueprint $table) {
                $table->id('issued_certificate_id');
                $table->string('certificate_type', 30)->default('baptismal');
                $table->string('person_name', 150);

                $table->foreignId('baptism_id')
                    ->nullable()
                    ->constrained('baptism_forms', 'baptism_id')
                    ->nullOnDelete();
                $table->foreignId('request_id')
                    ->nullable()
                    ->constrained('manage_requests', 'request_id')
                    ->nullOnDelete();

                $table->string('purpose', 150)->nullable();
                $table->date('date_issued');
                $table->string('signatory_name', 150);
                $table->foreignId('signatory_priest_id')
                    ->nullable()
                    ->constrained('users', 'user_id')
                    ->nullOnDelete();

                /** Snapshot of the printed fields so a reprint matches the original exactly */
                $table->json('details');

                $table->foreignId('issued_by')
                    ->nullable()
                    ->constrained('users', 'user_id')
                    ->nullOnDelete();
                $table->timestamps();

                $table->index(['certificate_type', 'date_issued']);
                $table->index('person_name');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('issued_certificates');

        Schema::table('baptism_forms', function (Blueprint $table) {
            foreach (['register_line', 'register_page', 'register_no'] as $column) {
                if (Schema::hasColumn('baptism_forms', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('certificate_forms', function (Blueprint $table) {
            foreach (['birth_place', 'mother_name', 'father_name'] as $column) {
                if (Schema::hasColumn('certificate_forms', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
