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

    /**
     * Why this certificate cannot be reprinted, or null when it can.
     * A reprint needs the person to have requested a Baptismal Certificate first,
     * so the certificate must come from a (not cancelled) certificate request.
     */
    public function reprintBlockedReason(): ?string
    {
        $request = $this->request_id ? $this->request()->with('service')->first() : null;

        if (!$request) {
            return 'Reprint is only for certificates issued from a Baptismal Certificate request. Ask the person to request a Baptismal Certificate first.';
        }

        $service = $request->service;
        $isCertificateRequest = !empty($request->certificate_form_id)
            || $service?->category === 'certificate'
            || $service?->form_handler === 'baptismal_certificate'
            || str_contains(strtolower((string) $service?->service_type), 'certificate');

        if (!$isCertificateRequest) {
            return 'Reprint is only for certificates issued from a Baptismal Certificate request.';
        }

        if ($request->status === 'cancelled') {
            return 'The Baptismal Certificate request for this certificate was cancelled, so it cannot be reprinted.';
        }

        return null;
    }
}
