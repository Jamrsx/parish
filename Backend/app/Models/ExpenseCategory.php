<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExpenseCategory extends Model
{
    protected $table = 'expense_categories';

    protected $primaryKey = 'expense_category_id';

    protected $fillable = [
        'value',
        'label',
        'created_by',
    ];
}
