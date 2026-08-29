<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    resource_endpoint('financial_goals', [
        'fields' => ['name', 'target_amount', 'current_amount', 'target_date', 'status', 'notes'],
        'required' => ['name', 'target_amount'],
        'decimal' => ['target_amount', 'current_amount'],
        'enum' => ['status' => ['ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED']],
        'nullable' => ['current_amount', 'target_date', 'status', 'notes'],
        'auto_created_by' => true,
        'order_by' => 'target_date ASC, id DESC',
    ]);
});
