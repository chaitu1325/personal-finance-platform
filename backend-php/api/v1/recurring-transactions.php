<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    resource_endpoint('recurring_transactions', [
        'fields' => [
            'account_id', 'person_id', 'category_id', 'transaction_type', 'amount',
            'frequency', 'next_run_date', 'end_date', 'description',
        ],
        'required' => ['account_id', 'transaction_type', 'amount', 'frequency', 'next_run_date'],
        'integer' => ['account_id', 'person_id', 'category_id'],
        'decimal' => ['amount'],
        'enum' => [
            'transaction_type' => ['INCOME', 'EXPENSE', 'TRANSFER'],
            'frequency' => ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'],
        ],
        'nullable' => ['person_id', 'category_id', 'end_date', 'description'],
        'references' => [
            'account_id' => 'accounts',
            'person_id' => 'persons',
            'category_id' => ['table' => 'categories', 'allow_global' => true],
        ],
        'auto_created_by' => true,
        'order_by' => 'next_run_date ASC, id DESC',
    ]);
});
