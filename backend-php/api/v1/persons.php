<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    resource_endpoint('persons', [
        'fields' => ['full_name', 'relationship', 'date_of_birth', 'phone', 'email', 'notes', 'status'],
        'required' => ['full_name'],
        'enum' => ['status' => ['ACTIVE', 'INACTIVE']],
        'nullable' => ['relationship', 'date_of_birth', 'phone', 'email', 'notes'],
        'order_by' => 'full_name ASC',
    ]);
});
