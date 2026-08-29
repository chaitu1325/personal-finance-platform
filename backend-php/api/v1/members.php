<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    $user = require_auth();
    require_method('GET');
    $statement = db()->prepare(
        'SELECT u.id AS user_id, u.email, u.display_name, fm.member_role, fm.status, fm.joined_at
         FROM family_members fm
         INNER JOIN users u ON u.id = fm.user_id
         WHERE fm.family_id = ? ORDER BY fm.joined_at'
    );
    $statement->execute([(int) $user['family_id']]);
    respond(['items' => $statement->fetchAll()]);
});
