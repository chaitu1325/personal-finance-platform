# InfinityFree test deployment

This deployment is intended for browser-based testing. It publishes the Vite
web build and PHP API to the same InfinityFree document root so browser API
requests remain same-origin.

InfinityFree free hosting is not the production target for this personal
finance platform. Its browser security system blocks native mobile API calls,
webhooks and automated HTTP clients, remote MySQL is unavailable, and cron
jobs are disabled.

## Resulting server layout

```text
htdocs/
├── index.html
├── assets/
├── api/v1/
├── lib/
├── config/
│   ├── .htaccess
│   ├── config.example.php
│   └── config.php
└── .htaccess
```

`config.php` is created directly on the hosting account and is deliberately
excluded from deployment.

## One-time InfinityFree setup

1. Add the website/domain in InfinityFree and confirm its FTP document-root
   path. The primary domain normally uses `/htdocs/`; an additional domain may
   use `/<domain>/htdocs/`.
2. Create a MySQL database in the InfinityFree control panel and record the
   database hostname, name, username and password.
3. Open phpMyAdmin for that database and import these files in order:
   - `database/migrations/V001__foundation.sql`
   - `database/migrations/V002__full_finance_modules.sql`
4. After the first deployment, use the InfinityFree File Manager or an FTPS
   client to copy `htdocs/config/config.example.php` to
   `htdocs/config/config.php`.
5. Replace every placeholder in `config.php`. Use the website's HTTPS origin
   for `cors_origin`, the database hostname shown by InfinityFree, and a long
   random JWT secret. A suitable secret can be generated locally with
   `openssl rand -hex 32`.
6. Do not commit `config.php` or paste its contents into workflow logs.

## GitHub environment configuration

Create a GitHub Actions environment named `infinityfree-test` and configure:

| Type | Name | Example |
| --- | --- | --- |
| Secret | `INFINITYFREE_FTP_USERNAME` | Value from InfinityFree FTP Details |
| Secret | `INFINITYFREE_FTP_PASSWORD` | InfinityFree FTP password |
| Variable | `INFINITYFREE_SERVER_DIR` | `/htdocs/` |

The server directory must end with `/`. Add environment protection or required
reviewers in GitHub if deployment approval is required.

## Deploy

1. Merge the reviewed deployment pull request after CI passes.
2. Open **Actions → Deploy to InfinityFree → Run workflow**.
3. Select the `main` branch and run the workflow.
4. The workflow builds React with `VITE_API_BASE_URL=/api/v1`, validates PHP,
   checks InfinityFree file-size limits, assembles a release directory and
   uploads it over FTPS to `ftpupload.net`.
5. On the first deployment, finish creating `config/config.php` as described
   above. Later deployments preserve that file.

## Browser verification

1. Open `https://YOUR_INFINITYFREE_DOMAIN/` in a normal browser.
2. Open `https://YOUR_INFINITYFREE_DOMAIN/api/v1/health` and confirm the JSON
   response reports both the application and database as healthy.
3. Register a temporary test account, sign in, create an account and create a
   transaction.
4. Refresh a browser route and confirm the React application loads instead of
   returning 404.
5. Confirm that requesting `/config/config.php` returns 403.

GitHub Actions does not execute production database migrations or an HTTP
health check against InfinityFree. Apply future migrations through phpMyAdmin
in version order until a secured browser-driven migration feature is added.

## References

- [InfinityFree browser security system](https://forum.infinityfree.com/t/browser-security-system-features-and-limitations/49353)
- [InfinityFree FTP guidance](https://forum.infinityfree.com/t/unable-to-ftp-for-new-account-and-domain/120145)
- [InfinityFree upload locations and file limits](https://forum.infinityfree.com/t/why-are-my-files-deleted-after-uploading-them/49310)
- [InfinityFree remote MySQL limitation](https://forum.infinityfree.com/t/i-cannot-connect-to-mysql-server-but-i-still-can-open-it-via-php-admin/88559)
- [InfinityFree cron limitation](https://forum.infinityfree.com/t/cron-jobs/108641)
- [FTP Deploy Action](https://github.com/SamKirkland/FTP-Deploy-Action)
