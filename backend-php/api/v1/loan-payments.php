<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    resource_endpoint('loan_payments', [
        'fields' => [
            'liability_id', 'payment_date', 'amount', 'principal_amount', 'interest_amount', 'notes',
        ],
        'required' => ['liability_id', 'payment_date', 'amount'],
        'integer' => ['liability_id'],
        'decimal' => ['amount', 'principal_amount', 'interest_amount'],
        'nullable' => ['principal_amount', 'interest_amount', 'notes'],
        'references' => ['liability_id' => 'liabilities'],
        'auto_created_by' => true,
        'order_by' => 'payment_date DESC, id DESC',
    ]);
});
