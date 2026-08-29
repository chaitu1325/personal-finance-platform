<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    resource_endpoint('liabilities', [
        'fields' => [
            'name', 'liability_type', 'lender', 'original_amount', 'outstanding_amount',
            'interest_rate', 'start_date', 'due_date', 'minimum_payment', 'status', 'notes',
        ],
        'required' => ['name', 'liability_type', 'original_amount', 'outstanding_amount'],
        'decimal' => ['original_amount', 'outstanding_amount', 'interest_rate', 'minimum_payment'],
        'enum' => [
            'liability_type' => ['LOAN', 'CREDIT_CARD', 'MORTGAGE', 'PERSONAL', 'OTHER'],
            'status' => ['ACTIVE', 'PAID_OFF', 'DEFAULTED', 'INACTIVE'],
        ],
        'nullable' => [
            'lender', 'interest_rate', 'start_date', 'due_date', 'minimum_payment', 'status', 'notes',
        ],
        'auto_created_by' => true,
        'order_by' => 'status ASC, due_date ASC, id DESC',
    ]);
});
