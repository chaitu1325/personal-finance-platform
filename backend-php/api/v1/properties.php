<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    resource_endpoint('properties', [
        'fields' => [
            'property_name', 'address', 'city', 'state', 'country', 'postal_code',
            'property_type', 'units_count', 'purchase_date', 'purchase_value', 'current_value',
            'status', 'notes',
        ],
        'required' => ['property_name', 'property_type'],
        'integer' => ['units_count'],
        'decimal' => ['purchase_value', 'current_value'],
        'enum' => [
            'property_type' => ['RESIDENTIAL', 'COMMERCIAL', 'LAND', 'OTHER'],
            'status' => ['ACTIVE', 'INACTIVE', 'SOLD'],
        ],
        'nullable' => [
            'address', 'city', 'state', 'country', 'postal_code', 'units_count',
            'purchase_date', 'purchase_value', 'current_value', 'status', 'notes',
        ],
        'auto_created_by' => true,
        'order_by' => 'property_name ASC',
    ]);
});
