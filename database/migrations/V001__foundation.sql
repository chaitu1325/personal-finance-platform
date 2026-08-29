-- Personal Finance Platform - Phase 1 foundation
-- Apply this file to an existing MySQL database. It does not create a database.

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
    PRIMARY KEY (id),
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
