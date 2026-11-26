<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

/*
|--------------------------------------------------------------------------
| Console Routes
|--------------------------------------------------------------------------
|
| This file is where you may define all of your Closure based console
| commands. Each Closure is bound to a command instance allowing a
| simple approach to interacting with each command's IO methods.
|
*/

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('reminders:services', function () {
    $created = \App\Models\ManageRequest::syncServiceReminders();
    $this->info("Day-before service reminders sent: {$created}");
})->purpose('Send parishioners a reminder (8 AM to 9 PM) for booked services tomorrow and discard old ones');
