# MVP verification results

Verification completed: 2026-11-14 (Asia/Riyadh). Work and checks spanned November 13–14.

## Environment and scope

- Windows, Node.js 20.16.0, npm 10.8.1.
- Actual PostgreSQL 17, started with the project-local portable development runner
  on 127.0.0.1:55432. Persistent data is stored in ignored `.local/postgres`.
- Prisma CLI/client 6.12.0; one initial SQL migration file, applied
  successfully to the local demo database and separate integration database.
- Headless locally installed Google Chrome through Playwright 1.65.0.
- Demo and integration databases are separate. Integration tests refuse a
  non-loopback URL or a database name that does not end in `_test`.
- No GitHub push, public deployment, mobile app, or production-data import.

## Final command results

| Command / check | Actual result |
|---|---|
| `npm install` | Passed; required local packages installed, root lockfile updated; final installation audit reported 0 vulnerabilities. |
| `npm run demo:configure` | Passed; generated random ignored local settings without printing passwords. |
| `npm run dev:db` | Passed; PostgreSQL 17 started, demo/test databases created, existing data preserved. |
| `npm run db:generate` | Passed; Prisma 6.12.0 client generated for the MVP schema. |
| `npm run db:migrate` | Passed; initial tables, relationships, indexes and additional quantity/money constraints applied. |
| `npm run db:validate` | Passed on the final schema. |
| `npm run db:seed` | Passed; OWNER/EMPLOYEE accounts and synthetic inventory created from local environment settings. |
| Repeated `db:seed` | Passed; before/after fingerprints of accounts, medicine values, batches and sales matched. No passwords, edited prices, stock quantities or sales were reset. |
| `npm test` | Passed: 7 foundation/unit tests, 0 failed, 0 skipped. |
| `npm run test:integration` | Passed: 12 PostgreSQL scenario subtests; Node reports 13 including the enclosing test. 0 failed, 0 skipped. |
| `npm run typecheck` | Passed for shared contracts, API source/tests, and web. |
| `npm run build` | Passed: shared package, NestJS backend, optimized Next.js frontend. |
| `npm run test:e2e` | Final run passed: all 3 browser scenarios, 0 skipped; 23.1 seconds reported. |
| Source secret/conflict review | Passed; no generated environment secret values or conflict markers found in trackable source files. Local environment, PostgreSQL data and test outputs are ignored by Git. |
| Original source preservation | Requirements analysis and both assignment PDFs retained their previously recorded SHA-256 hashes. Database proposal remains preserved as historical design input. |

## All thirteen final acceptance requirements

| # | Acceptance requirement | Result and evidence |
|---|---|---|
| 1 | Owner can log in | PASS — HTTP authentication with the correct role, HttpOnly/SameSite cookie; owner browser login also passed. |
| 2 | Employee can log in | PASS — independent employee account/session; browser login passed. |
| 3 | Both roles access permitted functions | PASS — protected routes reject anonymous access; both roles exercise medicine/stock operations. Employee navigation omits owner reports. |
| 4 | Owner sees supplier purchase prices | PASS — owner cost route returns the persisted decimal; owner inventory/report UI shows it. |
| 5 | Employee cannot receive supplier prices, including direct API requests | PASS — cost read/write and owner report routes return 403; batch/alerts/dashboard/medicine/sale responses do not contain purchase-price fields, including when a query attempts to request them. |
| 6 | Medicine can be added and saved | PASS — employee API creation is confirmed against PostgreSQL; browser owner creation, search and details pass. Medicine editing also passes. |
| 7 | Stock batches can be added and saved | PASS — owner batch creation persists quantity, expiry and cost; employee can create a no-cost batch but cannot submit a cost. Browser owner batch creation passes. |
| 8 | Correct expiry alerts | PASS — stored expired and near-expiry batches appear with correct status; in-date batches outside the threshold do not. Calendar boundary and invalid dates are unit tested. |
| 9 | Expired medicine cannot be sold | PASS — API rejects expired batches without a sale or deduction; UI excludes expired stock from eligible choices. |
| 10 | Insufficient stock cannot be sold | PASS — API rejects requests above available stock; browser review displays the rejection; stored quantity remains unchanged. |
| 11 | Valid sale saves and updates stock | PASS — multi-item sale and deductions persisted together; browser sale changed its selected batch from 25 to 23 units. |
| 12 | Historical prices survive current-price changes | PASS — API changes the catalog price and verifies the old SaleItem/total; browser edit to 3000 leaves the saved 2500 unit price visible in sale history. |
| 13 | Reports show actual stored information | PASS — owner report quantities and dashboard medicine count are compared with database queries; browser stock and expiry reports pass. |

The acceptance numbers above are the user's checklist, not invented assignment
requirement IDs. Original TC01–TC12 and FR/NFR/SR IDs remain documented in the
[public requirements summary](public-requirements.md), with the full source analysis preserved locally.

## Additional important checks

The [unit tests](../apps/api/test/policies.test.ts) verify exact decimal arithmetic,
overflow/non-finite rejection, pharmacy-calendar expiry boundaries, duplicate
batch-line grouping, and salted password hashing/verification. Existing health and
port checks remain in [the foundation tests](../apps/api/test/health.test.ts).

The [PostgreSQL integration suite](../apps/api/test/mvp.integration.test.ts) additionally verifies:

- Two simultaneous requests for four units from a five-unit batch produce only
  one successful sale, leaving one unit. They cannot both succeed.
- Repeating the same sale request UUID returns the original sale without a second
  stock deduction. Reusing that UUID for a different payload is rejected.
- A stale reviewed price is rejected after a medicine price change.
- A mixed valid/expired cart saves no sale and changes no stock.
- A controlled test-only database constraint deliberately rejects the Sale insert
  **after** the stock decrement. PostgreSQL rolls the decrement back. The client
  receives a generic 500 without database details. The suite removes its own
  temporary constraint afterwards; it does not reset either database.
- Expired sessions cannot authenticate; logout revokes the employee session.
- Malformed input and unexpected mutation origins are rejected.

The [browser suite](../tests/e2e/mvp.spec.ts) verifies:

1. Owner login, actual dashboard, medicine creation/search/details, batch creation,
   visible private purchase cost, and stock/expiry reports.
2. Employee login, hidden owner navigation/cost column, direct HTTP access denial,
   expiry alerts, insufficient-stock rejection, successful sale, persisted stock
   update, price editing, historical-price preservation, and logout.
3. Navigation at 390×844 without whole-page horizontal overflow.

A 1440×960 dashboard screenshot was captured locally and visually inspected.
It uses real database counts and records. Browser traces/videos are disabled;
password entry is not embedded in source or printed in test output.

## Failures encountered and resolved

- The first integration invocation resolved Prisma's package import entry instead
  of its executable and failed before application checks. The harness now locates
  the CLI through its package directory; subsequent PostgreSQL runs passed.
- The first browser run used a label selector that did not resolve the batch
  dropdown. It now selects the accessible combobox role/name; that scenario passed.
- An expanded medicine-details check initially exceeded its short wait while a
  development route was becoming ready. Both direct page loading and client-link
  navigation were checked successfully. The suite now explicitly waits for the
  destination URL with a bounded 15-second readiness timeout; the final full run
  passed, including the details page.
- Attempts to start additional listeners on 3000/3001 reported `EADDRINUSE`.
  Existing listeners already served the updated MVP, so browser checks used them
  without stopping unknown processes. Builds passed independently. Do not run
  duplicate development and production servers on the same ports.
- Docker-based startup was not executed: Docker is unavailable. This did not
  require a database substitution because real local PostgreSQL 17 was started
  successfully. The alternative Compose path remains documented but unverified.

No failing checks remain in the final unit, integration, browser, type-check, or
build runs. The deliberately injected database error is a passing rollback test,
not an unresolved application failure.

## Limits of this verification

This verifies a local synthetic-data MVP, not production readiness. Restore from
backup, server-crash recovery, realistic pharmacy load/NFR-04 benchmarking,
multi-host deployment, browser/OS matrices beyond this machine, and legal or
pharmacy-policy compliance were not tested. SR-09 production backup/recovery work
and owner confirmation of the [MVP assumptions](mvp-decisions.md) remain before
real pharmacy operation. A clean `npm ci` was verified for the earlier foundation;
this MVP dependency update used `npm install`, not a newly claimed clean-install test.
