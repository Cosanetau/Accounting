# COSA Accounting

Internal accounting app for COSA Pty Ltd at `accounting.cosa.net.au`.

## Features

- **Income** — import paid Stripe subscription invoices, or add manual sales
- **Expenses** — record supplier bills with GST breakdown and receipt upload
- **Log book** — travel and activity log for your accountant
- **People** — invite your accountant with their own login (separate from COSA Core workshop staff)

## Setup

1. Run `supabase/accounting-schema.sql` in Supabase
2. Create a private Storage bucket: `accounting-receipts`
3. Copy `.env.example` to `.env.local` and fill in Supabase keys
4. Add the same env vars in Vercel, plus `STRIPE_SECRET_KEY` for Stripe import
5. Create your first owner user in Supabase:

```sql
-- After creating a Supabase auth user for yourself:
insert into accounting_users (auth_user_id, email, display_name, role)
values ('YOUR_AUTH_USER_UUID', 'you@example.com', 'Caleb', 'owner');
```

6. Deploy to Vercel and point `accounting.cosa.net.au` at the project

## Dev

```bash
npm install
npm run dev
```

## Stripe import

Uses the same Stripe account as COSA Core subscriptions. Click **Import from Stripe** on the Income tab to pull paid invoices that are not already imported.
