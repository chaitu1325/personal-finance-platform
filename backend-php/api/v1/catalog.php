<?php
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    require_method('GET');
    require_auth();
    $names = ['persons' => 'Family people', 'properties' => 'Rental properties', 'transactions' => 'Income & expenses', 'goals' => 'Goals', 'recurring-transactions' => 'Recurring schedules'];
    $labels = ['entry_type' => 'Income / expense type', 'institution' => 'Bank / institution name', 'frequency' => 'Recurrence', 'is_active' => 'Active (1=yes, 0=paused)'];
    $specs = pf_resource_specs();
    $tableKeys = array_column($specs, 'resource', 'table');
    $modules = [];
    foreach ($specs as $key => $spec) {
        $fields = [];
        foreach ($spec['fields'] as $name) {
            $rule = $spec['columns'][$name] ?? [];
            $reference = $spec['references'][$name] ?? null;
            $referenceTable = is_array($reference) ? $reference['table'] : $reference;
            $field = ['name' => $name, 'label' => $labels[$name] ?? ucfirst(str_replace('_', ' ', $name)),
                'type' => $rule['type'] ?? 'text', 'required' => in_array($name, $spec['required'], true),
                'nullable' => $rule['nullable'] ?? false];
            foreach (['default', 'maxLength', 'scale', 'min'] as $property) {
                if (array_key_exists($property, $rule)) $field[$property] = $rule[$property];
            }
            if (isset($spec['enum'][$name])) { $field['type'] = 'select'; $field['options'] = $spec['enum'][$name]; }
            if ($referenceTable) { $field['type'] = 'reference'; $field['resource'] = $tableKeys[$referenceTable]; $field['label'] = ucfirst(str_replace('_id', '', $name)); }
            if ($name === 'entry_type') $field['options_by_direction'] = pf_entry_types();
            if (in_array($name, ['notes', 'description'], true)) $field['type'] = 'textarea';
            if ($key === 'transactions' && in_array($name, ['frequency', 'end_date'], true)) $field['create_only'] = true;
            $fields[] = $field;
        }
        $modules[] = ['key' => $key, 'label' => $names[$key] ?? ucfirst(str_replace('-', ' ', $key)), 'endpoint' => '/' . $key, 'fields' => $fields];
    }
    respond(['modules' => $modules]);
});
