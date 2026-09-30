<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IssuedCertificate extends Model
{
    public const TYPE_BAPTISMAL = 'baptismal';

    protected $primaryKey = 'issued_certificate_id';

    protected $fillable = [
        'certificate_type',
        'person_name',
        'baptism_id',
        'request_id',
        'purpose',
        'date_issued',
        'signatory_name',
        'signatory_priest_id',
        'details',
        'issued_by',
    ];

    protected $casts = [
        'details' => 'array',
        'date_issued' => 'date:Y-m-d',
    ];

    public function issuedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by', 'user_id');
    }

    public function baptism(): BelongsTo
    {
        return $this->belongsTo(BaptismForm::class, 'baptism_id', 'baptism_id');
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(ManageRequest::class, 'request_id', 'request_id');
    }
}
