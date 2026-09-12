<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    resource_endpoint('persons', pf_resource_specs()['persons']);
});
