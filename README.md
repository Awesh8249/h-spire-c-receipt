# H Spire C Receipt — Cloudflare handoff

This is the source for the **H Spire C Receipt** site, based on its saved Site version 29. It is prepared for Cloudflare Workers with D1. It contains application code and the database schema, but **not live receipt/admin records or secrets**.

## Before first deployment

1. Keep this repository private. Do not add a database export or `.dev.vars` file to GitHub.
2. In `wrangler.jsonc`, replace `REPLACE_WITH_YOUR_CLOUDFLARE_D1_DATABASE_ID` with the ID shown for your D1 database. If you named it differently from `h-spirec-db`, update `database_name` too. Keep the binding name `DB`.
3. Add the D1 migration from `migrations/0001_initial_schema.sql` to the new, empty D1 database once. Do not apply it to a database that already has these tables.
4. In the Cloudflare Worker settings, set the app variables/secrets before using administrator setup:
   - `ADMIN_SESSION_SECRET` — secret, at least 32 random characters.
   - `ADMIN_BOOTSTRAP_CODE` — secret, one-time setup code.
   - `HEAD_ADMIN_RECOVERY_CODE` — secret recovery code for the head administrator.
   - `HEAD_ADMIN_MOBILE` — the 10-digit head administrator mobile number.
   - `SETUP_ADMIN_MOBILES` — comma-separated 10-digit numbers allowed to create the first admin password.
   - `GOOGLE_SHEETS_WEBHOOK_URL` and `GOOGLE_SHEETS_SECRET_KEY` — optional; set only if you want the existing Sheets copy feature.

Do not place secret values in source files or GitHub. Set them through Cloudflare Worker **Settings → Variables and Secrets**.

## Cloudflare build

- Framework: Vite/Vinext
- Build command: `npm run build`
- Deploy command: `npm run deploy`
- Root directory: `/`

The app uses Cloudflare's Vite plugin and the D1 binding `DB`. `migrations/0001_initial_schema.sql` creates the app tables; it does not contain existing records. Keep any existing records in a separate private SQL export and import them only after creating the tables.

## Database safety

`drizzle/` contains the original schema history. For a new D1 database, use the single consolidated Cloudflare migration in `migrations/`. Do not run both sets of migrations on the same database.
