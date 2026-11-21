# Pharmacy Management System

A working local MVP for an SE421 professor demonstration, based on Assignments 1
and 2 and the needs of a pharmacy in Al-Hamdaniyah, Mosul, Iraq.

The dashboard uses persistent PostgreSQL records. This is a demonstration MVP;
owner-confirmed policies and production readiness are future work.

## What is implemented

- OWNER / EMPLOYEE login with salted scrypt password hashes, HttpOnly session
  cookies, database-backed session revocation, and backend access control.
- Medicine list, search, add, edit, and details.
- Multiple stock batches per medicine, quantities, expiry dates, and private
  supplier purchase prices. Employees never receive purchase-price fields.
- Expired and approaching-expiry alerts; expired batches are blocked from sales.
- Multi-item sales with exact decimal totals, historical price snapshots,
  idempotent confirmation, and transactional stock deductions.
- Owner-only stock and expiry reports and a dashboard showing actual stored values.
- Responsive desktop/mobile layout; the mobile application itself is not started.

No online ordering, customer accounts, payment processing, accounting, or
microservices are included.

## Architecture and project layout

| Area | Technology / responsibility |
|---|---|
| Runtime | Browser application: Node.js 20.16+; desktop tooling/services: pinned local Node.js 22.23.5; npm 10 workspaces |
| Web | Next.js 16.4.6, React 19.3.1, TypeScript |
| API | NestJS 11.2.10; thin controllers and application services |
| Database | PostgreSQL 17 and Prisma 6.12.0 migrations/client |
| Validation / authentication | Zod; Node crypto scrypt; opaque sessions |
| Verification | Node test runner; PostgreSQL integration tests; Playwright/Chrome |

```text
apps/web/src/app/           Login and workspace routes
apps/web/src/features/      Dashboard, medicines, inventory, expiry, sales, reports
apps/web/src/components/    Authentication context and reusable UI
apps/api/src/auth/          Authentication service and access guard
apps/api/src/medicines/     Medicine service/controller
apps/api/src/inventory/     Stock and purchase-price access
apps/api/src/domain/        Expiry and exact-money policies
apps/api/src/sales/         Sale orchestration and transactions
apps/api/src/reports/       Database-derived reports and dashboard
apps/api/src/database/      Prisma persistence service
apps/api/prisma/            Schema, migration, safe demo seed
packages/shared/           Shared TypeScript response contracts
scripts/                   Local configuration and PostgreSQL runner
infrastructure/docker/     Alternative Docker Compose PostgreSQL configuration
.local/                    Ignored persistent local database and test screenshots
```

Assignment 2's layered architecture is retained: frontend presentation, backend
application services, and Prisma technical services. The database proposal and
original requirement IDs are preserved. Review:

- [Anonymized requirements summary](docs/public-requirements.md)
- [Database design proposal](docs/database-design-proposal.md)
- [MVP decisions and demonstration assumptions](docs/mvp-decisions.md)
- [Actual test results](docs/mvp-test-results.md)
- [Five-minute demonstration script](docs/professor-demo-script.md)
- [Project engineering rules](AGENTS.md)

The public repository includes the application source and anonymized requirements.
Original assignment PDFs and the full requirements analysis remain local because
they contain identifiable people and private pharmacy context. Local environment
files, database records, backups and generated output are also excluded.

## Quick start: this Windows machine without Docker

Docker and a system PostgreSQL installation were unavailable. The local runner
uses real PostgreSQL 17 binaries supplied by the `embedded-postgres` development
package, with SCRAM authentication and persistent files. It is not SQLite or an
in-memory substitute. Its beta-labeled wrapper is a local development convenience,
not a production database deployment. The existing Docker configuration is retained.

Run commands from the project root. No global framework CLI is needed.

```powershell
node --version
npm --version
npm run desktop:setup
npm run demo:configure
```

`desktop:setup` downloads only a checksum-pinned Node.js 22.23.5 executable into
ignored `.local/runtimes`, then installs workspace dependencies through that
runtime and your existing npm 10 CLI. This is needed because patched Electron's
installer requires Node.js 22.12+. It does not install or replace system Node.js,
change permanent PATH settings, or touch the database/environment configuration.
For later reproducible installs use `npm run desktop:npm -- ci`, followed by
`npm run desktop:electron:install` to prepare Electron's binary before offline use.
Browser application commands remain compatible with system Node.js 20.16.0;
`.nvmrc` and the existing application TypeScript target remain unchanged.

`demo:configure` creates an ignored API `.env` with random local database and demo
account passwords, only if the file does not already exist. It never overwrites
existing settings or prints passwords. If you already have an environment file,
compare it with [the example](apps/api/.env.example) and supply missing values yourself.

**Terminal 1 — start PostgreSQL and keep it running:**

```powershell
npm run dev:db
```

The generated default uses `127.0.0.1:55432` and creates `pharmacy_mvp` plus the
separate `pharmacy_mvp_test` database. Data remains in `.local/postgres` when the
server stops. Do not delete this folder or reset databases to troubleshoot a port
conflict. Stop the owning terminal with Ctrl+C before restarting the same server.

**Terminal 2 — generate the client, apply migrations, seed, start the API:**

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:api
```

Migrations are applied using `prisma migrate deploy`; there is no automatic reset
or `db push`. The API listens on <http://127.0.0.1:3001>.

**Terminal 3 — start the web application:**

```powershell
npm run dev:web
```

Open <http://127.0.0.1:3000/login>. Browser calls use the same-origin `/api` proxy;
there is no browser-stored bearer token or direct browser database connection.

### Demo logins

The generated usernames are `owner.demo` and `employee.demo`. Open the ignored
local `apps/api/.env` in your editor to obtain `SEED_OWNER_PASSWORD` and
`SEED_EMPLOYEE_PASSWORD`. No shared password is hardcoded in the seed or this
README. Never record the environment file, copy its content into chat, or commit it.

Seeding requires `ALLOW_DEMO_SEED=true`, non-production mode, strong environment
passwords, and a loopback database whose name ends in `_mvp`. It creates synthetic
inventory, not real pharmacy/customer records. Repeat runs preserve existing
accounts, edited prices, quantities and sales. Changing seed environment passwords
alone does not change an already-created account's password.

### Local configuration

| Variable | Initial demonstration value / purpose |
|---|---|
| DATABASE_URL | Generated PostgreSQL URL for pharmacy_mvp |
| TEST_DATABASE_URL | Separate loopback database ending in _test |
| PORT | 3001 |
| WEB_ORIGIN | http://127.0.0.1:3000; unexpected mutation origins are rejected |
| APP_TIME_ZONE | Asia/Baghdad |
| EXPIRY_ALERT_DAYS | 30; configurable from 1 to 365 |
| DISPLAY_CURRENCY | IQD; display label, no currency conversion |
| ALLOW_DEMO_SEED | Explicit local-only seeding opt-in |

Prices are decimal strings with up to four fractional digits. Quantities are
whole units. The demo treats the printed expiry date as the first unusable day:
stock expiring today or earlier cannot be sold. Month-only expiry input is not
silently converted. These are documented MVP assumptions, not confirmed production
policies. Restart the API after changing its environment settings.

Use `127.0.0.1` consistently. If you change the API port, set server-only
`API_INTERNAL_URL` in the web environment and restart/rebuild Next.js. Never use
`NEXT_PUBLIC_*` variables for secrets.

## Windows desktop development (Electron integration in verification)

The separate [desktop workspace](apps/desktop/) uses pinned Electron 45.3.2 and
hosts the existing web application in a secured PharmaDesk window. Browser commands
above are unchanged. Read the
[desktop integration notes and verification status](docs/desktop-integration.md)
before using it: the complete lifecycle test still requires the existing browser
services to be stopped in their original terminals.

After completing the existing local database setup, stop the three browser-mode
services in their original terminals, then run from the root:

```powershell
npm run dev:desktop
```

The launcher verifies the local Node.js executable's pinned SHA-256 and version,
then explicitly uses it for desktop-owned services. Check it with
`npm run desktop:node`. Electron has its own bundled Node.js for its main process;
renderer Node integration remains disabled.

This builds shared contracts, the API, and Electron's TypeScript main process;
starts PostgreSQL, the API, and Next.js development in order; and opens
`http://127.0.0.1:3000` only after readiness checks succeed. It does not initialize,
migrate, seed, reset, or delete database data. Close the window or use Ctrl+C in
its owning terminal to stop its services. Occupied ports cause a safe startup
failure; existing services are never adopted or terminated.

```powershell
npm run test:desktop
npm run test:desktop:lifecycle
```

The lifecycle suite requires Windows desktop access and all three service ports
free. It restarts actual services, uses read-only database fingerprints to check
preservation, and never seeds or runs migrations. No installer is produced.

## PostgreSQL with Docker instead

If Docker Engine/Desktop and Compose v2 are available, copy
[the Docker environment example](infrastructure/docker/.env.example) to its ignored
`.env` and replace the password placeholder. Set POSTGRES_DB to `pharmacy_mvp`.
Then run:

```powershell
npm run db:up
npm run db:logs
```

Update the API DATABASE_URL to match that database, password, and port (5432 by
default), then run client generation, migration, and seed commands above. For
integration tests, create a separate database ending in `_test` on that server
and set TEST_DATABASE_URL; the portable runner creates it automatically, Compose
alone does not. Do not use the same database for demo and tests.

```powershell
npm run db:stop
```

Named Docker volumes persist. Initialization passwords do not change merely by
editing an environment file after the volume exists. No data-removal command is
part of normal setup. Database backups and tested restoration required by SR-09
remain work before real pharmacy use.

## Verification and local production builds

```powershell
npm run db:validate
npm test
npm run test:integration
npm run typecheck
npm run build
```

The integration suite applies migrations only to a loopback TEST_DATABASE_URL
ending in `_test`, creates synthetic uniquely named records, and does not reset
the demo database. No acceptance tests are silently skipped when the database is
missing. See [test results](docs/mvp-test-results.md) for checks actually executed.

After building, use separate terminals:

```powershell
npm run start:api
npm run start:web
```

These occupy the same ports as development servers. Do not run both modes on the
same ports. An `EADDRINUSE` message means a listener already owns that port;
check whether the application is already running before stopping any process.

With PostgreSQL, API and web running, execute browser tests:

```powershell
npm run test:e2e
```

The default uses locally installed Google Chrome. If Chrome is unavailable, install
a Playwright browser locally with `npx playwright install chromium`, then set
`$env:PLAYWRIGHT_CHANNEL='chromium'` in that terminal. Browser tests use environment
passwords without embedding them in source or enabling traces/videos. They create
synthetic demo records and sales. E2E_WEB_URL can override the default web address.

`GET /health` is a public process-liveness endpoint. It does not certify database
readiness. All pharmacy routes require a valid session; report/cost routes also
require OWNER. No PostgreSQL account/credentials are exposed to browser code.

## Troubleshooting login

The web page can load while the backend is stopped. In browser development mode,
keep PostgreSQL (`npm run dev:db`), the API (`npm run dev:api`) and the frontend
(`npm run dev:web`) running in three separate terminals. Loading the login page
alone does not confirm the API is running; check <http://127.0.0.1:3001/health>.

For desktop mode, close browser-mode services in their original terminals first,
then use `npm run dev:desktop` to start all services in order. Do not reset or reseed
the database, change demo passwords, or weaken Origin validation to fix a stopped
service.

If PowerShell blocks `npm.ps1` with a scripts-disabled message, use `npm.cmd`
in the commands above (for example, `npm.cmd run dev:api`); no system execution
policy change is required.

The web client reports unstructured proxy failures as an unavailable API and
preserves backend messages for invalid credentials and Origin rejection. Its
regression checks run with `npm run test --workspace @pharmacy/web`.

## Recording and remaining scope

Use the [five-minute professor script](docs/professor-demo-script.md). Keep the
random passwords ready privately before recording. Demonstrate both roles and
show stock changing after a real saved sale.

This local MVP is not publicly deployed. Production backup/recovery, security
operations, owner-confirmed policies, regulatory review and long-term inventory
corrections/auditing remain future work. Publishing the source repository does not
deploy the application or expose the local database.
Dependencies and a single root lockfile remain local to npm workspaces. Keep secrets,
build outputs, browser traces, pharmacy data and backups out of Git. Review all
changes before any later commit.
