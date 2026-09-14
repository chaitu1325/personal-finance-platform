<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    resource_endpoint('rent_payments', pf_resource_specs()['rent-payments']);
});
