<?php
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    require_method('POST');
    $user = require_auth();
    respond(pf_process_recurring($user, gmdate('Y-m-d')));
});
