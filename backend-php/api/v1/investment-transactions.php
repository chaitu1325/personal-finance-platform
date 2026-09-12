<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    resource_endpoint('investment_transactions', pf_resource_specs()['investment-transactions']);
});
