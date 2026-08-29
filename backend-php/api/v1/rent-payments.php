<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    resource_endpoint('rent_payments', [
        'fields' => [
            'agreement_id', 'amount', 'due_date', 'paid_date', 'payment_status',
            'transaction_id', 'notes',
        ],
        'required' => ['agreement_id', 'amount', 'due_date', 'payment_status'],
        'integer' => ['agreement_id', 'transaction_id'],
        'decimal' => ['amount'],
        'enum' => ['payment_status' => ['DUE', 'PARTIAL', 'PAID', 'LATE', 'WAIVED']],
        'nullable' => ['paid_date', 'transaction_id', 'notes'],
        'references' => ['agreement_id' => 'rental_agreements', 'transaction_id' => 'transactions'],
        'auto_created_by' => true,
        'order_by' => 'due_date DESC, id DESC',
    ]);
});
