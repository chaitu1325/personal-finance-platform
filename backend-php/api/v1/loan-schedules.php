<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    resource_endpoint('loan_schedules', [
        'fields' => [
            'liability_id', 'due_date', 'principal_due', 'interest_due', 'status', 'paid_date',
        ],
        'required' => ['liability_id', 'due_date', 'principal_due', 'interest_due', 'status'],
        'integer' => ['liability_id'],
        'decimal' => ['principal_due', 'interest_due'],
        'enum' => ['status' => ['DUE', 'PAID', 'LATE', 'WAIVED']],
        'nullable' => ['paid_date'],
        'references' => ['liability_id' => 'liabilities'],
        'auto_created_by' => true,
        'order_by' => 'due_date ASC, id ASC',
    ]);
});
