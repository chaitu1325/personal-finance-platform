<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    resource_endpoint('rental_agreements', [
        'fields' => [
            'unit_id', 'person_id', 'start_date', 'end_date', 'monthly_rent',
            'deposit_amount', 'status', 'notes',
        ],
        'required' => ['unit_id', 'person_id', 'start_date', 'monthly_rent', 'status'],
        'integer' => ['unit_id', 'person_id'],
        'decimal' => ['monthly_rent', 'deposit_amount'],
        'enum' => ['status' => ['DRAFT', 'ACTIVE', 'ENDED', 'TERMINATED']],
        'nullable' => ['end_date', 'deposit_amount', 'notes'],
        'references' => ['unit_id' => 'rental_units', 'person_id' => 'persons'],
        'auto_created_by' => true,
        'order_by' => 'start_date DESC, id DESC',
    ]);
});
