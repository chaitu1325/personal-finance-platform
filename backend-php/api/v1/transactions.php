<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    resource_endpoint('transactions', [
        'fields' => [
            'account_id', 'person_id', 'category_id', 'transaction_type', 'amount',
            'transaction_date', 'description', 'reference_number',
        ],
        'required' => ['account_id', 'transaction_type', 'amount', 'transaction_date'],
        'integer' => ['account_id', 'person_id', 'category_id'],
        'decimal' => ['amount'],
        'enum' => ['transaction_type' => ['INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT']],
        'nullable' => ['person_id', 'category_id', 'description', 'reference_number'],
        'references' => [
            'account_id' => 'accounts',
            'person_id' => 'persons',
            'category_id' => ['table' => 'categories', 'allow_global' => true],
        ],
        'filters' => ['type' => 'transaction_type', 'account' => 'account_id'],
        'ranges' => [
            'from' => ['column' => 'transaction_date', 'operator' => '>='],
            'to' => ['column' => 'transaction_date', 'operator' => '<='],
        ],
        'auto_created_by' => true,
        'order_by' => 'transaction_date DESC, id DESC',
    ]);
});
