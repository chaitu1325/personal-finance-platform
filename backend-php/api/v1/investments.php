<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    resource_endpoint('investments', [
        'fields' => [
            'name', 'investment_type', 'account_id', 'institution', 'symbol',
            'quantity', 'average_cost', 'current_price', 'purchase_date', 'status', 'notes',
        ],
        'required' => ['name', 'investment_type'],
        'integer' => ['account_id'],
        'decimal' => ['quantity', 'average_cost', 'current_price'],
        'enum' => [
            'investment_type' => ['STOCK', 'MF', 'BOND', 'ETF', 'CRYPTO', 'FD', 'REAL_ESTATE', 'OTHER'],
            'status' => ['ACTIVE', 'SOLD', 'MATURED', 'INACTIVE'],
        ],
        'nullable' => [
            'account_id', 'institution', 'symbol', 'quantity', 'average_cost',
            'current_price', 'purchase_date', 'status', 'notes',
        ],
        'references' => ['account_id' => 'accounts'],
        'auto_created_by' => true,
        'order_by' => 'name ASC',
    ]);
});
