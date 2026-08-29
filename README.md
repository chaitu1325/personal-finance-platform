# Personal Finance Platform

A family-focused personal finance workspace for web and mobile. It combines income and expense tracking with family people, rental management, investments, assets, liabilities, budgets and goals.

## Current delivery

The full domain implementation is delivered in one reviewable branch/PR after the Phase 1 foundation was merged into main.

- PHP 8.3 REST API with a stable /api/v1 contract
- React + Vite web application with authentication, dashboard and CRUD starter forms
- React Native + Expo mobile read-oriented dashboard shell
- MySQL migrations V001 foundation and V002 full finance modules
- JWT authentication, Argon2id password hashing, family-scoped authorization, input allowlists and parameterized SQL
- GitHub Actions validation for the web build and PHP syntax

This is an application-ready development increment. Production hosting, secrets, payment/bank integrations, store submissions and destructive migrations still require an explicit release decision.

## Repository layout

- backend-php: API endpoints and shared PHP libraries
- database/migrations: ordered MySQL migration scripts
- apps/web: React web client
- apps/mobile: Expo mobile client
- packages/api-client: small shared fetch client
- packages/api-types: shared module and enum metadata
- docs: implementation and release notes

## Local setup

1. Create a MySQL database and apply V001__foundation.sql followed by V002__full_finance_modules.sql.
2. Copy backend-php/config/config.example.php to backend-php/config/config.php, or set environment variables.
3. Set DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD and a long random JWT_SECRET.
4. Start the API from the repository root:

~~~text
php -S 0.0.0.0:8080 -t backend-php
~~~

5. Start the web app:

~~~text
cd apps/web
npm install
npm run dev
~~~

Set VITE_API_BASE_URL when the API is not at http://localhost:8080/api/v1. For Expo, set EXPO_PUBLIC_API_BASE_URL.

## API conventions

- JSON request and response bodies
- Success responses are wrapped in data; collection endpoints return data.items and data.meta
- Errors are returned as error.code and error.message
- Use Authorization: Bearer <JWT> for all endpoints except health, register and login
- All records are scoped to the authenticated user's active family
- Collection CRUD uses GET, POST, PUT/PATCH and DELETE /api/v1/<resource>?id=<id>
- List supports limit, offset and the filters documented in the endpoint source

## Main endpoints

- /health, /auth/register, /auth/login
- /family, /members, /persons, /accounts, /categories
- /transactions, /recurring-transactions, /budgets, /goals
- /properties, /rental-units, /rental-agreements, /rent-payments
- /investments, /investment-transactions
- /assets, /asset-valuations
- /liabilities, /loan-schedules, /loan-payments
- /dashboard, /reports?type=cashflow|spending|net-worth, /notifications

## Delivery and branch policy

Work is developed from main on a feature branch and submitted as a pull request. Do not commit directly to main. Review the pull request and CI result before merging. Apply database migrations in a controlled environment before any production release.

## Follow-up hardening

- Add integration tests with a disposable MySQL service and API contract tests
- Add refresh-token rotation, rate limiting, email verification and account recovery
- Add background jobs for recurring entries, rent reminders and loan schedules
- Add audit event writes, object storage for documents and observability
- Introduce the Java Spring Boot adapter behind the same API contract when the PHP implementation is ready to be replaced
