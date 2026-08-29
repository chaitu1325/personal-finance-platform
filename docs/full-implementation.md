# Full implementation handoff

## Scope

This increment combines the approved product areas in one branch: authentication, family people, cash accounts, income and expenses, recurring transactions, budgets, goals, rental management, investments, assets, liabilities, reporting and notifications.

The service remains a modular monolith. The domain boundaries are represented by tables and endpoint modules, while the transaction and family ownership rules stay shared. A future Java service can implement the same versioned HTTP contract without changing the web or mobile clients.

## Request flow

1. The client registers or signs in.
2. The API issues an HS256 JWT containing the user subject and expiry.
3. Each protected request resolves the active family through family_members.
4. Resource endpoints validate allowlisted fields, verify family-owned foreign keys and execute parameterized SQL.
5. Dashboard and report queries aggregate the same transaction, asset, property, investment and liability records.

## Data model additions

V002 adds tables for budgets, goals, recurring transactions, properties, rental units, rental agreements, rent payments, investments, investment transactions, assets, asset valuations, liabilities, loan schedules, loan payments and notifications. Every domain table carries family_id and created_by where a user action creates the record.

## Acceptance checks

- A new user can register, sign in and receive a JWT.
- A protected request without a bearer token returns 401.
- A record from another family cannot be read or referenced.
- Income and expense transactions appear in dashboard cash flow.
- Assets, properties, investments and liabilities contribute to the net-worth response.
- Web build and PHP syntax checks pass in CI.
- No production migration or deployment is performed by this change.

## Release sequence

1. Review the combined PR and the CI run.
2. Apply V002 to a test MySQL database populated with a small fixture.
3. Run API smoke tests for auth, CRUD, dashboard and report endpoints.
4. Verify web and Expo environment variables against the test API.
5. Approve a separate release change for production secrets, backups, migration execution and hosting.
