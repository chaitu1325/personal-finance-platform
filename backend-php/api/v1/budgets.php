<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    resource_endpoint('budgets', [
        'fields' => [
            'category_id', 'period_start', 'period_end', 'amount', 'alert_percent', 'status', 'notes',
        ],
        'required' => ['period_start', 'period_end', 'amount'],
        'integer' => ['category_id', 'alert_percent'],
        'decimal' => ['amount'],
        'enum' => ['status' => ['ACTIVE', 'ARCHIVED']],
        'nullable' => ['category_id', 'alert_percent', 'status', 'notes'],
        'references' => ['category_id' => ['table' => 'categories', 'allow_global' => true]],
        'auto_created_by' => true,
        'order_by' => 'period_start DESC, id DESC',
    ]);
});
