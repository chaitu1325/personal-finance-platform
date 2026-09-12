<?php
declare(strict_types=1);

// One allowlist for API writes, CSV imports and web/mobile form metadata.
function pf_resource_specs(): array
{
    static $specs;
    if ($specs !== null) return $specs;
    $specs = [
        'accounts' => ['table' => 'accounts'] + [
        'fields' => ['name', 'account_type', 'institution', 'description', 'opening_balance', 'currency', 'status'],
        'required' => ['name', 'account_type'],
        'enum' => [
            'account_type' => ['CASH', 'BANK', 'CREDIT_CARD', 'WALLET', 'INVESTMENT', 'OTHER'],
            'status' => ['ACTIVE', 'INACTIVE'],
        ],
        'decimal' => ['opening_balance'],
        'allow_negative' => ['opening_balance'],
        'nullable' => ['institution', 'description', 'opening_balance', 'currency'],
        'order_by' => 'name ASC',
    ],
        'transactions' => ['table' => 'transactions'] + [
        'fields' => [
            'account_id', 'person_id', 'category_id', 'transaction_type', 'amount',
            'transaction_date', 'description', 'reference_number',
        ],
        'required' => ['account_id', 'transaction_type', 'amount', 'transaction_date'],
        'integer' => ['account_id', 'person_id', 'category_id'],
        'decimal' => ['amount'],
        'enum' => ['transaction_type' => ['INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT']],
        'nullable' => ['person_id', 'category_id', 'description', 'reference_number'],
        'references' => [
            'account_id' => 'accounts',
            'person_id' => 'persons',
            'category_id' => ['table' => 'categories', 'allow_global' => true],
        ],
        'filters' => ['type' => 'transaction_type', 'account' => 'account_id'],
        'ranges' => [
            'from' => ['column' => 'transaction_date', 'operator' => '>='],
            'to' => ['column' => 'transaction_date', 'operator' => '<='],
        ],
        'auto_created_by' => true,
        'order_by' => 'transaction_date DESC, id DESC',
    ],
        'categories' => ['table' => 'categories'] + [
        'fields' => ['name', 'category_type'],
        'required' => ['name', 'category_type'],
        'enum' => ['category_type' => ['INCOME', 'EXPENSE', 'TRANSFER']],
        'include_global' => true,
        'filters' => ['type' => 'category_type'],
        'order_by' => 'category_type ASC, name ASC',
    ],
        'persons' => ['table' => 'persons'] + [
        'fields' => ['full_name', 'relationship', 'date_of_birth', 'phone', 'email', 'notes', 'status'],
        'required' => ['full_name'],
        'enum' => ['status' => ['ACTIVE', 'INACTIVE']],
        'nullable' => ['relationship', 'date_of_birth', 'phone', 'email', 'notes'],
        'order_by' => 'full_name ASC',
    ],
        'properties' => ['table' => 'properties'] + [
        'fields' => [
            'property_name', 'address', 'city', 'state', 'country', 'postal_code',
            'property_type', 'units_count', 'purchase_date', 'purchase_value', 'current_value',
            'status', 'notes',
        ],
        'required' => ['property_name', 'property_type'],
        'integer' => ['units_count'],
        'decimal' => ['purchase_value', 'current_value'],
        'enum' => [
            'property_type' => ['RESIDENTIAL', 'COMMERCIAL', 'LAND', 'OTHER'],
            'status' => ['ACTIVE', 'INACTIVE', 'SOLD'],
        ],
        'nullable' => [
            'address', 'city', 'state', 'country', 'postal_code', 'units_count',
            'purchase_date', 'purchase_value', 'current_value', 'status', 'notes',
        ],
        'auto_created_by' => true,
        'order_by' => 'property_name ASC',
    ],
        'rental-units' => ['table' => 'rental_units'] + [
        'fields' => [
            'property_id', 'unit_label', 'bedrooms', 'monthly_rent', 'deposit_amount', 'status', 'notes',
        ],
        'required' => ['property_id', 'unit_label', 'monthly_rent'],
        'integer' => ['property_id', 'bedrooms'],
        'decimal' => ['monthly_rent', 'deposit_amount'],
        'enum' => ['status' => ['VACANT', 'OCCUPIED', 'MAINTENANCE', 'INACTIVE']],
        'nullable' => ['bedrooms', 'deposit_amount', 'status', 'notes'],
        'references' => ['property_id' => 'properties'],
        'auto_created_by' => true,
        'order_by' => 'property_id ASC, unit_label ASC',
    ],
        'rental-agreements' => ['table' => 'rental_agreements'] + [
        'fields' => [
            'unit_id', 'person_id', 'start_date', 'end_date', 'monthly_rent',
            'deposit_amount', 'status', 'notes',
        ],
        'required' => ['unit_id', 'person_id', 'start_date', 'monthly_rent', 'status'],
        'integer' => ['unit_id', 'person_id'],
        'decimal' => ['monthly_rent', 'deposit_amount'],
        'enum' => ['status' => ['DRAFT', 'ACTIVE', 'ENDED', 'TERMINATED']],
        'nullable' => ['end_date', 'deposit_amount', 'notes'],
        'references' => ['unit_id' => 'rental_units', 'person_id' => 'persons'],
        'auto_created_by' => true,
        'order_by' => 'start_date DESC, id DESC',
    ],
        'rent-payments' => ['table' => 'rent_payments'] + [
        'fields' => [
            'agreement_id', 'amount', 'due_date', 'paid_date', 'payment_status',
            'transaction_id', 'notes',
        ],
        'required' => ['agreement_id', 'amount', 'due_date', 'payment_status'],
        'integer' => ['agreement_id', 'transaction_id'],
        'decimal' => ['amount'],
        'enum' => ['payment_status' => ['DUE', 'PARTIAL', 'PAID', 'LATE', 'WAIVED']],
        'nullable' => ['paid_date', 'transaction_id', 'notes'],
        'references' => ['agreement_id' => 'rental_agreements', 'transaction_id' => 'transactions'],
        'auto_created_by' => true,
        'order_by' => 'due_date DESC, id DESC',
    ],
        'investments' => ['table' => 'investments'] + [
        'fields' => [
            'name', 'investment_type', 'account_id', 'institution', 'symbol',
            'quantity', 'average_cost', 'current_price', 'purchase_date', 'status', 'notes',
        ],
        'required' => ['name', 'investment_type'],
        'integer' => ['account_id'],
        'decimal' => ['quantity', 'average_cost', 'current_price'],
        'enum' => [
            'investment_type' => ['STOCK', 'MF', 'BOND', 'ETF', 'CRYPTO', 'FD', 'REAL_ESTATE', 'OTHER'],
            'status' => ['ACTIVE', 'SOLD', 'MATURED', 'INACTIVE'],
        ],
        'nullable' => [
            'account_id', 'institution', 'symbol', 'quantity', 'average_cost',
            'current_price', 'purchase_date', 'status', 'notes',
        ],
        'references' => ['account_id' => 'accounts'],
        'auto_created_by' => true,
        'order_by' => 'name ASC',
    ],
        'investment-transactions' => ['table' => 'investment_transactions'] + [
        'fields' => [
            'investment_id', 'transaction_type', 'trade_date', 'quantity', 'price', 'fees', 'notes',
        ],
        'required' => ['investment_id', 'transaction_type', 'trade_date', 'quantity', 'price'],
        'integer' => ['investment_id'],
        'decimal' => ['quantity', 'price', 'fees'],
        'enum' => ['transaction_type' => ['BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'OTHER']],
        'nullable' => ['fees', 'notes'],
        'references' => ['investment_id' => 'investments'],
        'auto_created_by' => true,
        'order_by' => 'trade_date DESC, id DESC',
    ],
        'assets' => ['table' => 'assets'] + [
        'fields' => [
            'name', 'asset_type', 'purchase_date', 'purchase_value', 'current_value',
            'person_id', 'status', 'notes',
        ],
        'required' => ['name', 'asset_type'],
        'integer' => ['person_id'],
        'decimal' => ['purchase_value', 'current_value'],
        'enum' => [
            'asset_type' => ['REAL_ESTATE', 'VEHICLE', 'ELECTRONICS', 'JEWELLERY', 'CASH', 'OTHER'],
            'status' => ['ACTIVE', 'SOLD', 'DISPOSED'],
        ],
        'nullable' => [
            'purchase_date', 'purchase_value', 'current_value', 'person_id', 'status', 'notes',
        ],
        'references' => ['person_id' => 'persons'],
        'auto_created_by' => true,
        'order_by' => 'name ASC',
    ],
        'asset-valuations' => ['table' => 'asset_valuations'] + [
        'fields' => ['asset_id', 'valuation_date', 'value', 'notes'],
        'required' => ['asset_id', 'valuation_date', 'value'],
        'integer' => ['asset_id'],
        'decimal' => ['value'],
        'nullable' => ['notes'],
        'references' => ['asset_id' => 'assets'],
        'auto_created_by' => true,
        'order_by' => 'valuation_date DESC, id DESC',
    ],
        'liabilities' => ['table' => 'liabilities'] + [
        'fields' => [
            'name', 'liability_type', 'lender', 'original_amount', 'outstanding_amount',
            'interest_rate', 'start_date', 'due_date', 'minimum_payment', 'status', 'notes',
        ],
        'required' => ['name', 'liability_type', 'original_amount', 'outstanding_amount'],
        'decimal' => ['original_amount', 'outstanding_amount', 'interest_rate', 'minimum_payment'],
        'enum' => [
            'liability_type' => ['LOAN', 'CREDIT_CARD', 'MORTGAGE', 'PERSONAL', 'OTHER'],
            'status' => ['ACTIVE', 'PAID_OFF', 'DEFAULTED', 'INACTIVE'],
        ],
        'nullable' => [
            'lender', 'interest_rate', 'start_date', 'due_date', 'minimum_payment', 'status', 'notes',
        ],
        'auto_created_by' => true,
        'order_by' => 'status ASC, due_date ASC, id DESC',
    ],
        'loan-schedules' => ['table' => 'loan_schedules'] + [
        'fields' => [
            'liability_id', 'due_date', 'principal_due', 'interest_due', 'status', 'paid_date',
        ],
        'required' => ['liability_id', 'due_date', 'principal_due', 'interest_due', 'status'],
        'integer' => ['liability_id'],
        'decimal' => ['principal_due', 'interest_due'],
        'enum' => ['status' => ['DUE', 'PAID', 'LATE', 'WAIVED']],
        'nullable' => ['paid_date'],
        'references' => ['liability_id' => 'liabilities'],
        'auto_created_by' => true,
        'order_by' => 'due_date ASC, id ASC',
    ],
        'loan-payments' => ['table' => 'loan_payments'] + [
        'fields' => [
            'liability_id', 'payment_date', 'amount', 'principal_amount', 'interest_amount', 'notes',
        ],
        'required' => ['liability_id', 'payment_date', 'amount'],
        'integer' => ['liability_id'],
        'decimal' => ['amount', 'principal_amount', 'interest_amount'],
        'nullable' => ['principal_amount', 'interest_amount', 'notes'],
        'references' => ['liability_id' => 'liabilities'],
        'auto_created_by' => true,
        'order_by' => 'payment_date DESC, id DESC',
    ],
        'budgets' => ['table' => 'budgets'] + [
        'fields' => [
            'category_id', 'period_start', 'period_end', 'amount', 'alert_percent', 'status', 'notes',
        ],
        'required' => ['period_start', 'period_end', 'amount'],
        'integer' => ['category_id', 'alert_percent'],
        'decimal' => ['amount'],
        'enum' => ['status' => ['ACTIVE', 'ARCHIVED']],
        'nullable' => ['category_id', 'alert_percent', 'status', 'notes'],
        'references' => ['category_id' => ['table' => 'categories', 'allow_global' => true]],
        'auto_created_by' => true,
        'order_by' => 'period_start DESC, id DESC',
    ],
        'goals' => ['table' => 'financial_goals'] + [
        'fields' => ['name', 'target_amount', 'current_amount', 'target_date', 'status', 'notes'],
        'required' => ['name', 'target_amount'],
        'decimal' => ['target_amount', 'current_amount'],
        'enum' => ['status' => ['ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED']],
        'nullable' => ['current_amount', 'target_date', 'status', 'notes'],
        'auto_created_by' => true,
        'order_by' => 'target_date ASC, id DESC',
    ],
        'recurring-transactions' => ['table' => 'recurring_transactions'] + [
        'fields' => [
            'account_id', 'person_id', 'category_id', 'transaction_type', 'amount',
            'frequency', 'next_run_date', 'end_date', 'description',
        ],
        'required' => ['account_id', 'transaction_type', 'amount', 'frequency', 'next_run_date'],
        'integer' => ['account_id', 'person_id', 'category_id'],
        'decimal' => ['amount'],
        'enum' => [
            'transaction_type' => ['INCOME', 'EXPENSE', 'TRANSFER'],
            'frequency' => ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'],
        ],
        'nullable' => ['person_id', 'category_id', 'end_date', 'description'],
        'references' => [
            'account_id' => 'accounts',
            'person_id' => 'persons',
            'category_id' => ['table' => 'categories', 'allow_global' => true],
        ],
        'auto_created_by' => true,
        'order_by' => 'next_run_date ASC, id DESC',
    ]
    ];
    $columns = json_decode(file_get_contents(__DIR__ . '/resource-schema.json'), true, 512, JSON_THROW_ON_ERROR);
    foreach ($specs as $key => &$spec) {
        $spec['resource'] = $key;
        $spec['columns'] = $columns[$spec['table']];
    }
    unset($spec);
    foreach (['transactions', 'recurring-transactions'] as $key) {
        $specs[$key]['fields'][] = 'entry_type';
        $specs[$key]['enum']['entry_type'] = array_values(array_unique(array_merge(...array_values(pf_entry_types()))));
    }
    $specs['transactions']['fields'][] = 'frequency';
    $specs['transactions']['fields'][] = 'end_date';
    $specs['transactions']['columns']['end_date'] = ['type' => 'date', 'nullable' => true];
    $specs['transactions']['enum']['frequency'] = ['ONETIME', 'WEEKLY', 'MONTHLY', 'YEARLY'];
    $specs['transactions']['filters'] += ['category' => 'category_id', 'entry_type' => 'entry_type'];
    $specs['recurring-transactions']['fields'][] = 'is_active';
    $specs['recurring-transactions']['integer'][] = 'is_active';
    $specs['recurring-transactions']['enum']['frequency'][] = 'ONETIME';
    $specs['accounts']['filters'] = ['status' => 'status'];
    return $specs;
}

function pf_entry_types(): array
{
    return [
        'INCOME' => ['SALARY', 'RENTAL', 'DIVIDEND', 'INTEREST', 'BUSINESS', 'BONUS', 'GIFT', 'OTHER'],
        'EXPENSE' => ['PURCHASE', 'BILL', 'RENT', 'EMI', 'SUBSCRIPTION', 'TAX', 'INSURANCE', 'OTHER'],
        'TRANSFER' => ['OTHER'],
        'ADJUSTMENT' => ['OTHER'],
    ];
}
