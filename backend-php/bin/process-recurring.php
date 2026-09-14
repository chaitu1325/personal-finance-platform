<?php
declare(strict_types=1);
// CLI only. Never expose a job secret or an unauthenticated web execution endpoint.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__) . '/lib/bootstrap.php';
require_once dirname(__DIR__) . '/lib/response.php';
require_once dirname(__DIR__) . '/lib/resource.php';
require_once dirname(__DIR__) . '/lib/resource-specs.php';
require_once dirname(__DIR__) . '/lib/finance.php';

$families = db()->query('SELECT id, owner_user_id FROM families');
$failed = false;
foreach ($families->fetchAll() as $family) {
    try {
        $result = pf_process_recurring(['family_id' => (int) $family['id'], 'user_id' => (int) $family['owner_user_id']], gmdate('Y-m-d'));
        echo json_encode(['family_id' => $family['id']] + $result) . PHP_EOL;
    } catch (Throwable $error) {
        error_log('Recurring processing failed for family ' . $family['id'] . ': ' . $error->getMessage());
        $failed = true;
    }
}
exit($failed ? 1 : 0);
