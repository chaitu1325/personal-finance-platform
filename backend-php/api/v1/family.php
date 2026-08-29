<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    $user = require_auth();
    $familyId = (int) $user['family_id'];
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $pdo = db();

    if ($method === 'GET') {
        $statement = $pdo->prepare(
            'SELECT f.id, f.name, f.base_currency, f.owner_user_id, f.created_at, f.updated_at,
                    (SELECT COUNT(*) FROM family_members fm WHERE fm.family_id = f.id AND fm.status = \'ACTIVE\') AS member_count
             FROM families f WHERE f.id = ? LIMIT 1'
        );
        $statement->execute([$familyId]);
        $family = $statement->fetch();
        if (!is_array($family)) {
            respond_error('Family not found', 404);
        }
        respond($family);
    }

    if ($method === 'PUT' || $method === 'PATCH') {
        require_role(['OWNER', 'ADMIN']);
        $input = request_json();
        $updates = [];
        $params = [];
        if (array_key_exists('name', $input)) {
            $name = trim((string) $input['name']);
            if (strlen($name) < 2 || strlen($name) > 150) {
                respond_error('name must be between 2 and 150 characters', 422);
            }
            $updates[] = 'name = ?';
            $params[] = $name;
        }
        if (array_key_exists('base_currency', $input)) {
            $currency = strtoupper(trim((string) $input['base_currency']));
            if (!preg_match('/^[A-Z]{3}$/', $currency)) {
                respond_error('base_currency must be a 3-letter currency code', 422);
            }
            $updates[] = 'base_currency = ?';
            $params[] = $currency;
        }
        if ($updates === []) {
            respond_error('name or base_currency is required', 422);
        }
        $params[] = $familyId;
        $statement = $pdo->prepare(
            'UPDATE families SET ' . implode(', ', $updates) . ' WHERE id = ?'
        );
        pf_bind_and_execute($statement, $params);
        $fetch = $pdo->prepare('SELECT id, name, base_currency, owner_user_id, created_at, updated_at FROM families WHERE id = ?');
        $fetch->execute([$familyId]);
        respond($fetch->fetch());
    }

    respond_error('Method not allowed', 405);
});
