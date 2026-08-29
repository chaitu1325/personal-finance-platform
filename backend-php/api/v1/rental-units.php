<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    resource_endpoint('rental_units', [
        'fields' => [
            'property_id', 'unit_label', 'bedrooms', 'monthly_rent', 'deposit_amount', 'status', 'notes',
        ],
        'required' => ['property_id', 'unit_label', 'monthly_rent'],
        'integer' => ['property_id', 'bedrooms'],
        'decimal' => ['monthly_rent', 'deposit_amount'],
        'enum' => ['status' => ['VACANT', 'OCCUPIED', 'MAINTENANCE', 'INACTIVE']],
        'nullable' => ['bedrooms', 'deposit_amount', 'status', 'notes'],
        'references' => ['property_id' => 'properties'],
        'auto_created_by' => true,
        'order_by' => 'property_id ASC, unit_label ASC',
    ]);
});
