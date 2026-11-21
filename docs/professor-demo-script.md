# Five-minute SE421 professor demonstration

## Prepare privately before recording

Follow [the setup guide](../README.md). Keep PostgreSQL, API and web running. Seed
the synthetic demonstration accounts and inventory once. Privately copy the two
random demo passwords from your ignored API environment file. Never record that
file, clipboard history, a password-reveal control, or real pharmacy information.

Open the app at http://127.0.0.1:3000/login, preferably in a 1440×960 or larger
desktop window. Use the passing [test-results report](mvp-test-results.md) if you
want a concise verification slide. All medicine examples are demonstration data,
not dispensing advice or actual pharmacy records.

## Recording outline

| Time | Show | Suggested narration |
|---|---|---|
| 0:00–0:25 | Login page and project title | “This SE421 project addresses handwritten inventory, expiry tracking, and supplier-price privacy for a pharmacy in Al-Hamdaniyah, Mosul.” |
| 0:25–0:55 | Sign in as OWNER; dashboard | “The frontend is Next.js, the API is NestJS, and Prisma stores the records in PostgreSQL. These counts are database queries, not hardcoded statistics.” |
| 0:55–1:30 | Medicines: add a clearly named demo medicine, then open its details | “Authorized staff can add, search and edit medicine information. I am setting a current selling price of 1500 for this demonstration.” Use a new name so repeated recordings remain understandable. |
| 1:30–2:05 | Inventory: add a batch of 20 units, full future expiry date, and owner-only purchase price | “A medicine can have several stock batches with different expiry dates and purchase costs. Purchase prices are private owner information.” Show the seeded Paracetamol medicine's two batches if time permits. |
| 2:05–2:35 | Expiry alerts; expired and near-expiry tabs | “The alert window is configurable, initially 30 days. This conservative demo blocks stock expiring today or earlier. Expired records remain visible for stock management.” |
| 2:35–3:05 | Sign out; sign in as EMPLOYEE; inventory and navigation | “The employee can manage operational information, but the purchase-price column and owner reports are unavailable. The API enforces this too; direct requests to purchase-price and report routes return 403.” Optional: open `/api/batches/ID/purchase-price` for the batch just created in a new tab while still signed in as employee. Do not switch to the owner for this check. |
| 3:05–3:50 | Sales: choose the new medicine, eligible batch, quantity 2, review, confirm; return to inventory | “The backend checks stock and expiry, calculates an exact total, and saves the sale and stock deduction in one transaction. The batch now has 18 units.” Expired batches cannot be selected; insufficient quantities are rejected on review and again on confirmation. |
| 3:50–4:20 | Edit that medicine's current price to 1700; open the saved sale | “The historical sale still shows 1500 per unit. Sale items preserve their selling price at the time of sale, even after the catalog price changes.” |
| 4:20–4:45 | Sign in as OWNER; stock and expiry reports | “These reports show the same stored quantities and batch information. Only the owner can access them.” |
| 4:45–5:00 | Test-results document and closing dashboard | “Unit, PostgreSQL integration and browser checks cover authentication, privacy, expiry, stock rejection, valid sales, historical prices and concurrent stock updates. This is a local MVP; real-pharmacy policies and production hardening are the next stage.” |

## If something interrupts the recording

- An expired batch will not appear among eligible sales batches. Choose a future
  batch; do not change an expired date just to bypass the policy.
- If an insufficient-stock message appears, remove the draft line and enter an
  available quantity. No sale or deduction is committed for a rejected operation.
- If the price changed while a cart was open, review the total again before
  confirmation. The system does not silently use an old quote.
- Avoid repeated confirmation clicks. The request identifier protects a retry of
  the same confirmation against creating a duplicate sale.
- Do not reset the database between takes. Records persist; use a new clearly
  named demonstration medicine or continue with the stock left from the last take.
