<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    resource_endpoint('categories', [
        'fields' => ['name', 'category_type'],
        'required' => ['name', 'category_type'],
        'enum' => ['category_type' => ['INCOME', 'EXPENSE', 'TRANSFER']],
        'include_global' => true,
        'filters' => ['type' => 'category_type'],
        'order_by' => 'category_type ASC, name ASC',
    ]);
});
