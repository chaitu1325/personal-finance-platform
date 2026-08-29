<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    resource_endpoint('assets', [
        'fields' => [
            'name', 'asset_type', 'purchase_date', 'purchase_value', 'current_value',
            'person_id', 'status', 'notes',
        ],
        'required' => ['name', 'asset_type'],
        'integer' => ['person_id'],
        'decimal' => ['purchase_value', 'current_value'],
        'enum' => [
            'asset_type' => ['REAL_ESTATE', 'VEHICLE', 'ELECTRONICS', 'JEWELLERY', 'CASH', 'OTHER'],
            'status' => ['ACTIVE', 'SOLD', 'DISPOSED'],
        ],
        'nullable' => [
            'purchase_date', 'purchase_value', 'current_value', 'person_id', 'status', 'notes',
        ],
        'references' => ['person_id' => 'persons'],
        'auto_created_by' => true,
        'order_by' => 'name ASC',
    ]);
});
