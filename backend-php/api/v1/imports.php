<?php
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';
require_once dirname(__DIR__, 2) . '/lib/imports.php';

api_run(function (): void {
    $user = require_auth();
    $input = $_SERVER['REQUEST_METHOD'] === 'GET' ? $_GET : request_json();
    $resource = $input['resource'] ?? '';
    if (!is_string($resource) || !isset(pf_resource_specs()[$resource])) throw new ValidationException('Unsupported import resource');
    $spec = pf_resource_specs()[$resource];
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $direction = ($input['direction'] ?? '') === 'EXPENSE' ? 'EXPENSE' : 'INCOME';
        respond(['filename' => $resource . '-' . strtolower($direction) . '-sample.csv',
            'csv' => pf_csv_template($spec, $direction), 'max_bytes' => PF_IMPORT_MAX_BYTES, 'max_rows' => PF_IMPORT_MAX_ROWS]);
    }
    require_method('POST');
    if (!isset($input['csv']) || !is_string($input['csv'])) throw new ValidationException('csv must contain UTF-8 CSV text');
    if (!in_array($input['action'] ?? '', ['preview', 'commit'], true)) throw new ValidationException('action must be preview or commit');
    $rows = pf_import_rows($input['csv'], $spec);
    $hash = hash('sha256', json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
    if ($input['action'] === 'preview') {
        $check = db()->prepare('SELECT row_count FROM import_batches WHERE family_id = ? AND resource = ? AND content_hash = ?');
        $check->execute([$user['family_id'], $resource, $hash]);
        if ($check->fetch()) respond(['valid' => true, 'already_imported' => true, 'row_count' => count($rows), 'preview' => [], 'errors' => []]);
        respond(pf_import_validate($rows, $spec, $user));
    }
    $result = pf_atomic(function () use ($spec, $user, $resource, $rows, $hash) {
        $lock = db()->prepare('SELECT id FROM families WHERE id = ? FOR UPDATE');
        $lock->execute([$user['family_id']]);
        $check = db()->prepare('SELECT row_count FROM import_batches WHERE family_id = ? AND resource = ? AND content_hash = ?');
        $check->execute([$user['family_id'], $resource, $hash]);
        $previous = $check->fetch();
        if ($previous) return ['imported' => 0, 'already_imported' => true, 'previous_row_count' => (int) $previous['row_count']];
        // Validate after the duplicate check; retrying a category import must be harmless.
        // The transaction also rolls back earlier rows if a later row fails validation.
        foreach ($rows as $index => $row) {
            try {
                pf_create_record($spec, $row, $user);
            } catch (ValidationException $error) {
                throw new ValidationException('Row ' . ($index + 2) . ': ' . $error->getMessage() . '; no rows were saved');
            } catch (PDOException $error) {
                if ((string) $error->getCode() === '23000') throw new ValidationException('Row ' . ($index + 2) . ': duplicate or invalid related record; no rows were saved');
                throw $error;
            }
        }
        db()->prepare('INSERT INTO import_batches (family_id, resource, content_hash, row_count, created_by) VALUES (?, ?, ?, ?, ?)')
            ->execute([$user['family_id'], $resource, $hash, count($rows), $user['user_id']]);
        return ['imported' => count($rows), 'already_imported' => false];
    });
    respond($result);
});
