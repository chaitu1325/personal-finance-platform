-- Consolidated fresh install at V004. Import into an EMPTY selected database.
-- No historical migrations are required. For existing installations apply pending V00x files instead.

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    email VARCHAR(320) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'USER',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    default_currency CHAR(3) NOT NULL DEFAULT 'INR',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_email (email),
    KEY ix_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS families (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    owner_user_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    base_currency CHAR(3) NOT NULL DEFAULT 'INR',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_families_owner (owner_user_id),
    CONSTRAINT fk_families_owner FOREIGN KEY (owner_user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS family_members (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    family_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    member_role VARCHAR(30) NOT NULL DEFAULT 'MEMBER',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_family_members (family_id, user_id),
    KEY ix_family_members_user (user_id),
    CONSTRAINT fk_family_members_family FOREIGN KEY (family_id) REFERENCES families (id) ON DELETE CASCADE,
    CONSTRAINT fk_family_members_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS persons (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    family_id BIGINT UNSIGNED NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    relationship VARCHAR(80) NULL,
    date_of_birth DATE NULL,
    phone VARCHAR(40) NULL,
    email VARCHAR(320) NULL,
    notes TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_persons_family (family_id),
    CONSTRAINT fk_persons_family FOREIGN KEY (family_id) REFERENCES families (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS accounts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    family_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    account_type VARCHAR(40) NOT NULL,
    institution VARCHAR(150) NULL,
    description VARCHAR(500) NULL,
    opening_balance DECIMAL(19,4) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_accounts_family (family_id),
    CONSTRAINT fk_accounts_family FOREIGN KEY (family_id) REFERENCES families (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    family_id BIGINT UNSIGNED NULL,
    name VARCHAR(100) NOT NULL,
    category_type VARCHAR(30) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_categories_scope (family_id, name, category_type),
    KEY ix_categories_type (category_type),
    CONSTRAINT fk_categories_family FOREIGN KEY (family_id) REFERENCES families (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transactions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    family_id BIGINT UNSIGNED NOT NULL,
    account_id BIGINT UNSIGNED NOT NULL,
    person_id BIGINT UNSIGNED NULL,
    category_id BIGINT UNSIGNED NULL,
    transaction_type VARCHAR(30) NOT NULL,
    amount DECIMAL(19,4) NOT NULL,
    transaction_date DATE NOT NULL,
    description VARCHAR(255) NULL,
    reference_number VARCHAR(120) NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    entry_type VARCHAR(40) NOT NULL DEFAULT 'OTHER',
    frequency VARCHAR(20) NOT NULL DEFAULT 'ONETIME',
    recurring_id BIGINT UNSIGNED NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_recurring_occurrence (recurring_id, transaction_date),
    KEY ix_transactions_family_date (family_id, transaction_date),
    KEY ix_transactions_account_date (account_id, transaction_date),
    KEY ix_transactions_category (category_id),
    CONSTRAINT fk_transactions_family FOREIGN KEY (family_id) REFERENCES families (id) ON DELETE CASCADE,
    CONSTRAINT fk_transactions_account FOREIGN KEY (account_id) REFERENCES accounts (id),
    CONSTRAINT fk_transactions_person FOREIGN KEY (person_id) REFERENCES persons (id) ON DELETE SET NULL,
    CONSTRAINT fk_transactions_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
    CONSTRAINT fk_transactions_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(80) NULL,
    resource_id BIGINT UNSIGNED NULL,
    request_id VARCHAR(80) NULL,
    metadata JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_audit_user_date (user_id, created_at),
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS budgets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    family_id BIGINT UNSIGNED NOT NULL,
    category_id BIGINT UNSIGNED NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    amount DECIMAL(19,4) NOT NULL,
    alert_percent SMALLINT UNSIGNED NOT NULL DEFAULT 80,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    notes TEXT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_budgets_family_period (family_id, period_start, period_end),
    CONSTRAINT fk_budgets_family FOREIGN KEY (family_id) REFERENCES families (id) ON DELETE CASCADE,
    CONSTRAINT fk_budgets_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
    CONSTRAINT fk_budgets_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS financial_goals (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    family_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    target_amount DECIMAL(19,4) NOT NULL,
    current_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
    target_date DATE NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    notes TEXT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_goals_family_status (family_id, status),
    CONSTRAINT fk_goals_family FOREIGN KEY (family_id) REFERENCES families (id) ON DELETE CASCADE,
    CONSTRAINT fk_goals_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recurring_transactions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    family_id BIGINT UNSIGNED NOT NULL,
    account_id BIGINT UNSIGNED NOT NULL,
    person_id BIGINT UNSIGNED NULL,
    category_id BIGINT UNSIGNED NULL,
    transaction_type VARCHAR(30) NOT NULL,
    amount DECIMAL(19,4) NOT NULL,
    frequency VARCHAR(20) NOT NULL,
    next_run_date DATE NOT NULL,
    end_date DATE NULL,
    description VARCHAR(255) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    entry_type VARCHAR(40) NOT NULL DEFAULT 'OTHER',
    start_date DATE NULL,
    PRIMARY KEY (id),
    KEY ix_recurring_due (family_id, is_active, next_run_date),
    CONSTRAINT fk_recurring_family FOREIGN KEY (family_id) REFERENCES families (id) ON DELETE CASCADE,
    CONSTRAINT fk_recurring_account FOREIGN KEY (account_id) REFERENCES accounts (id),
    CONSTRAINT fk_recurring_person FOREIGN KEY (person_id) REFERENCES persons (id) ON DELETE SET NULL,
    CONSTRAINT fk_recurring_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
    CONSTRAINT fk_recurring_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS properties (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    family_id BIGINT UNSIGNED NOT NULL,
    property_name VARCHAR(150) NOT NULL,
    address VARCHAR(255) NULL,
    city VARCHAR(100) NULL,
    state VARCHAR(100) NULL,
    country VARCHAR(100) NULL,
    postal_code VARCHAR(30) NULL,
    property_type VARCHAR(30) NOT NULL,
    units_count INT UNSIGNED NOT NULL DEFAULT 1,
    purchase_date DATE NULL,
    purchase_value DECIMAL(19,4) NOT NULL DEFAULT 0,
    current_value DECIMAL(19,4) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    notes TEXT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_properties_family_status (family_id, status),
    CONSTRAINT fk_properties_family FOREIGN KEY (family_id) REFERENCES families (id) ON DELETE CASCADE,
    CONSTRAINT fk_properties_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rental_units (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    family_id BIGINT UNSIGNED NOT NULL,
    property_id BIGINT UNSIGNED NOT NULL,
    unit_label VARCHAR(80) NOT NULL,
    bedrooms SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    monthly_rent DECIMAL(19,4) NOT NULL,
    deposit_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'VACANT',
    notes TEXT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_rental_units_label (property_id, unit_label),
    KEY ix_rental_units_family_status (family_id, status),
    CONSTRAINT fk_rental_units_family FOREIGN KEY (family_id) REFERENCES families (id) ON DELETE CASCADE,
    CONSTRAINT fk_rental_units_property FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE,
    CONSTRAINT fk_rental_units_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rental_agreements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    family_id BIGINT UNSIGNED NOT NULL,
    unit_id BIGINT UNSIGNED NOT NULL,
    person_id BIGINT UNSIGNED NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    monthly_rent DECIMAL(19,4) NOT NULL,
    deposit_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    notes TEXT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_rental_agreements_family_status (family_id, status),
    CONSTRAINT fk_rental_agreements_family FOREIGN KEY (family_id) REFERENCES families (id) ON DELETE CASCADE,
    CONSTRAINT fk_rental_agreements_unit FOREIGN KEY (unit_id) REFERENCES rental_units (id),
    CONSTRAINT fk_rental_agreements_person FOREIGN KEY (person_id) REFERENCES persons (id),
    CONSTRAINT fk_rental_agreements_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rent_payments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    family_id BIGINT UNSIGNED NOT NULL,
    agreement_id BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(19,4) NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE NULL,
    payment_status VARCHAR(30) NOT NULL DEFAULT 'DUE',
    transaction_id BIGINT UNSIGNED NULL,
    notes TEXT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_rent_payments_due (family_id, due_date, payment_status),
    CONSTRAINT fk_rent_payments_family FOREIGN KEY (family_id) REFERENCES families (id) ON DELETE CASCADE,
    CONSTRAINT fk_rent_payments_agreement FOREIGN KEY (agreement_id) REFERENCES rental_agreements (id) ON DELETE CASCADE,
    CONSTRAINT fk_rent_payments_transaction FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE SET NULL,
    CONSTRAINT fk_rent_payments_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS investments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    family_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    investment_type VARCHAR(30) NOT NULL,
    account_id BIGINT UNSIGNED NULL,
    institution VARCHAR(150) NULL,
    symbol VARCHAR(40) NULL,
    quantity DECIMAL(24,8) NOT NULL DEFAULT 0,
    average_cost DECIMAL(19,4) NOT NULL DEFAULT 0,
    current_price DECIMAL(19,4) NOT NULL DEFAULT 0,
    purchase_date DATE NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    notes TEXT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_investments_family_status (family_id, status),
    CONSTRAINT fk_investments_family FOREIGN KEY (family_id) REFERENCES families (id) ON DELETE CASCADE,
    CONSTRAINT fk_investments_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE SET NULL,
    CONSTRAINT fk_investments_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS investment_transactions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    family_id BIGINT UNSIGNED NOT NULL,
    investment_id BIGINT UNSIGNED NOT NULL,
    transaction_type VARCHAR(30) NOT NULL,
    trade_date DATE NOT NULL,
    quantity DECIMAL(24,8) NOT NULL,
    price DECIMAL(19,4) NOT NULL,
    fees DECIMAL(19,4) NOT NULL DEFAULT 0,
    notes TEXT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_investment_transactions_date (family_id, trade_date),
    CONSTRAINT fk_investment_transactions_family FOREIGN KEY (family_id) REFERENCES families (id) ON DELETE CASCADE,
    CONSTRAINT fk_investment_transactions_investment FOREIGN KEY (investment_id) REFERENCES investments (id) ON DELETE CASCADE,
    CONSTRAINT fk_investment_transactions_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    family_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    asset_type VARCHAR(30) NOT NULL,
    purchase_date DATE NULL,
    purchase_value DECIMAL(19,4) NOT NULL DEFAULT 0,
    current_value DECIMAL(19,4) NOT NULL DEFAULT 0,
    person_id BIGINT UNSIGNED NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    notes TEXT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_assets_family_status (family_id, status),
    CONSTRAINT fk_assets_family FOREIGN KEY (family_id) REFERENCES families (id) ON DELETE CASCADE,
    CONSTRAINT fk_assets_person FOREIGN KEY (person_id) REFERENCES persons (id) ON DELETE SET NULL,
    CONSTRAINT fk_assets_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS asset_valuations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    family_id BIGINT UNSIGNED NOT NULL,
    asset_id BIGINT UNSIGNED NOT NULL,
    valuation_date DATE NOT NULL,
    value DECIMAL(19,4) NOT NULL,
    notes TEXT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_asset_valuations_date (family_id, valuation_date),
    CONSTRAINT fk_asset_valuations_family FOREIGN KEY (family_id) REFERENCES families (id) ON DELETE CASCADE,
    CONSTRAINT fk_asset_valuations_asset FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE,
    CONSTRAINT fk_asset_valuations_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS liabilities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    family_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    liability_type VARCHAR(30) NOT NULL,
    lender VARCHAR(150) NULL,
    original_amount DECIMAL(19,4) NOT NULL,
    outstanding_amount DECIMAL(19,4) NOT NULL,
    interest_rate DECIMAL(9,4) NOT NULL DEFAULT 0,
    start_date DATE NULL,
    due_date DATE NULL,
    minimum_payment DECIMAL(19,4) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    notes TEXT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_liabilities_family_status (family_id, status),
    CONSTRAINT fk_liabilities_family FOREIGN KEY (family_id) REFERENCES families (id) ON DELETE CASCADE,
    CONSTRAINT fk_liabilities_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loan_schedules (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    family_id BIGINT UNSIGNED NOT NULL,
    liability_id BIGINT UNSIGNED NOT NULL,
    due_date DATE NOT NULL,
    principal_due DECIMAL(19,4) NOT NULL DEFAULT 0,
    interest_due DECIMAL(19,4) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'DUE',
    paid_date DATE NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_loan_schedules_due (family_id, due_date, status),
    CONSTRAINT fk_loan_schedules_family FOREIGN KEY (family_id) REFERENCES families (id) ON DELETE CASCADE,
    CONSTRAINT fk_loan_schedules_liability FOREIGN KEY (liability_id) REFERENCES liabilities (id) ON DELETE CASCADE,
    CONSTRAINT fk_loan_schedules_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loan_payments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    family_id BIGINT UNSIGNED NOT NULL,
    liability_id BIGINT UNSIGNED NOT NULL,
    payment_date DATE NOT NULL,
    amount DECIMAL(19,4) NOT NULL,
    principal_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
    interest_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
    notes TEXT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_loan_payments_date (family_id, payment_date),
    CONSTRAINT fk_loan_payments_family FOREIGN KEY (family_id) REFERENCES families (id) ON DELETE CASCADE,
    CONSTRAINT fk_loan_payments_liability FOREIGN KEY (liability_id) REFERENCES liabilities (id) ON DELETE CASCADE,
    CONSTRAINT fk_loan_payments_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    family_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(180) NOT NULL,
    message VARCHAR(500) NOT NULL,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_notifications_user_read (user_id, read_at, created_at),
    CONSTRAINT fk_notifications_family FOREIGN KEY (family_id) REFERENCES families (id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS import_batches (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    family_id BIGINT UNSIGNED NOT NULL,
    resource VARCHAR(60) NOT NULL,
    content_hash CHAR(64) NOT NULL,
    row_count INT UNSIGNED NOT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_import_batch (family_id, resource, content_hash),
    CONSTRAINT fk_import_batch_family FOREIGN KEY (family_id) REFERENCES families (id) ON DELETE CASCADE,
    CONSTRAINT fk_import_batch_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Shared suggestions are read-only; family categories are added through the API.
INSERT INTO categories (family_id, name, category_type)
SELECT NULL, seeds.name, seeds.category_type FROM (
    SELECT 'Groceries' AS name, 'EXPENSE' AS category_type
    UNION ALL SELECT 'Housing', 'EXPENSE'
    UNION ALL SELECT 'Utilities', 'EXPENSE'
    UNION ALL SELECT 'Transport', 'EXPENSE'
    UNION ALL SELECT 'Health', 'EXPENSE'
    UNION ALL SELECT 'Education', 'EXPENSE'
    UNION ALL SELECT 'Entertainment', 'EXPENSE'
    UNION ALL SELECT 'Uncategorised', 'EXPENSE'
    UNION ALL SELECT 'Salary', 'INCOME'
    UNION ALL SELECT 'Rental', 'INCOME'
    UNION ALL SELECT 'Dividend', 'INCOME'
    UNION ALL SELECT 'Interest', 'INCOME'
    UNION ALL SELECT 'Other income', 'INCOME'
) seeds
WHERE NOT EXISTS (
    SELECT 1 FROM categories existing
    WHERE existing.family_id IS NULL AND existing.name = seeds.name
      AND existing.category_type = seeds.category_type
);
