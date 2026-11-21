# Local professor-demonstration MVP decisions

The user authorized implementation and the simplest safe demonstration assumptions. These choices supplement the full local requirements analysis, its [anonymized public summary](public-requirements.md), and the [database proposal](database-design-proposal.md); they are not claims that the pharmacy owner confirmed production policies. Original FR/NFR/SR/TC identifiers are unchanged.

## Database and infrastructure

- PostgreSQL remains the database, using Prisma migrations. No SQLite or in-memory persistence replacement is used.
- Docker and PostgreSQL were unavailable at inspection. A project-local `embedded-postgres` runner provides actual PostgreSQL 17 binaries and persistent storage in ignored `.local/postgres`. The npm wrapper has a beta version label; it is a development convenience, not a production dependency or a change to the Docker architecture. Docker Compose remains available.
- Preserve the five original entities and integer IDs. Add Session for revocable, database-backed opaque login sessions. Store only SHA-256 token hashes, not raw session tokens.
- Medicine name and currentSellingPrice are required; brand, description, barcode are optional. Barcode is text and is not constrained unique because product/barcode policy is unresolved. No deletion endpoints or inferred supplier/customer/payment tables.
- One current selling price per Medicine. Each StockBatch has its own quantity, full calendar expiry date and optional supplierPurchasePrice. OWNER must supply cost when adding a batch. EMPLOYEE can add stock without cost and can never submit/read costs; OWNER can subsequently record the missing cost. Missing cost is explicitly unknown, never zero.
- Quantities are whole units (1–1,000,000 per sale entry; nonnegative remaining stock). No pack conversion, fractional dispensing, returns, discounts, taxes, or accounting is implemented.
- Financial values are exact numeric(18,4). API prices are decimal strings with at most four fractional digits. IQD is the configurable display label (`DISPLAY_CURRENCY`), a demo assumption only; no conversion. Totals use exact decimal multiplication and addition. Values outside storage precision are rejected.

## Expiry policy

- Business calendar timezone defaults to `Asia/Baghdad` (`APP_TIME_ZONE`). Input must be YYYY-MM-DD; month-only labels are not silently interpreted.
- Conservative demo cutoff: the printed expiry date is the first unusable date. Batches expiring today or earlier cannot be sold. Changing this policy requires a documented implementation/test change.
- `EXPIRY_ALERT_DAYS` defaults to 30, configurable from 1 to 365. Near-expiry means after today through today + threshold, inclusive. Alerts show positive remaining quantities. Expired records remain in history.

## Authentication and access

- Login uses Node's scrypt with random salts, N=131072, r=8, p=1, and timing-safe verification. No password is hardcoded. Demo configuration generates random local passwords in ignored API environment settings; seeding requires explicit `ALLOW_DEMO_SEED=true`, non-production mode and environment-supplied account details.
- HttpOnly, SameSite=Strict, eight-hour opaque session cookies; Secure in production. No tokens/passwords in browser localStorage. Logout revokes the database session. No public registration, role administration, or password-recovery feature.
- API guard authenticates every business endpoint. Owner-only report and purchase-price routes return 403 to employees, including direct HTTP requests. Ordinary batch/sale responses use explicit field selections. Password hashes never appear in profile responses.
- Browser requests use a same-origin Next.js `/api` proxy. Mutation requests reject unexpected Origin values and non-JSON content; login attempts are limited in process memory. This single-process local limiter is not a distributed production security solution.
- Reports are owner-only stock and expiry reports. Employees see operational inventory, medicine details, expiry alerts, their own sales, and their own dashboard sale count. Owner sees all sales. No profit/accounting features.

## Sale integrity

- Each cart item selects one batch. Multiple batches/medicines can be sold together; duplicate batch entries are grouped before stock validation. No implicit FIFO/FEFO allocation.
- The backend previews totals. On confirmation it re-reads current prices and rejects a changed quote instead of silently using stale prices. SaleItem preserves unitSellingPrice and subtotal; Sale preserves totalAmount.
- A serializable database transaction contains all guarded stock decrements and sale/item inserts. Retry serialization conflicts up to three times; any invalid item rolls the entire transaction back. Every attempt rechecks business-date expiry and quantity.
- A request UUID and body fingerprint make sale retries idempotent. A key cannot be reused for a different payload/user. This prevents duplicate sales after uncertain network responses.
- Basic dashboard values are database queries, not sample constants. Seed data is clearly demonstration data and never seeded automatically on application startup. Seeding does not erase records or reset stock on repeat runs.

## Boundaries

This MVP is for a local demonstration, not real patient/pharmacy operation. Backups with tested restoration (SR-09), local regulatory review, production deployment hardening, owner-confirmed unit/currency/expiry policies, and long-term audit/correction processes remain work before live use. No mobile application, microservices, online orders, customer accounts, or payment processing.
