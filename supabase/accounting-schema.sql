-- COSA Accounting — internal books for COSA Pty Ltd (accounting.cosa.net.au)
-- Run in Supabase SQL editor after review.

create table if not exists accounting_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null default '',
  role text not null default 'accountant'
    check (role in ('owner', 'accountant', 'viewer')),
  active boolean not null default true,
  invited_by uuid references accounting_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists accounting_income (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  description text not null,
  customer_name text,
  amount_ex_gst numeric(12, 2) not null default 0,
  gst_amount numeric(12, 2) not null default 0,
  amount_inc_gst numeric(12, 2) not null default 0,
  source text not null default 'manual'
    check (source in ('manual', 'stripe')),
  stripe_charge_id text,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  category text not null default 'subscription',
  notes text,
  created_by uuid references accounting_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounting_income_stripe_charge_unique unique (stripe_charge_id),
  constraint accounting_income_stripe_invoice_unique unique (stripe_invoice_id)
);

create table if not exists accounting_expenses (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  supplier_name text not null,
  description text not null default '',
  amount_ex_gst numeric(12, 2) not null default 0,
  gst_amount numeric(12, 2) not null default 0,
  amount_inc_gst numeric(12, 2) not null default 0,
  gst_claimable boolean not null default true,
  category text not null default 'general',
  receipt_path text,
  receipt_filename text,
  notes text,
  created_by uuid references accounting_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists accounting_logbook_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  description text not null,
  purpose text not null default '',
  start_location text,
  end_location text,
  distance_km numeric(10, 2),
  notes text,
  created_by uuid references accounting_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounting_income_entry_date_idx on accounting_income (entry_date desc);
create index if not exists accounting_expenses_entry_date_idx on accounting_expenses (entry_date desc);
create index if not exists accounting_logbook_entry_date_idx on accounting_logbook_entries (entry_date desc);

alter table accounting_users enable row level security;
alter table accounting_income enable row level security;
alter table accounting_expenses enable row level security;
alter table accounting_logbook_entries enable row level security;

create or replace function accounting_current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from accounting_users
  where auth_user_id = auth.uid()
    and active = true
  limit 1;
$$;

create or replace function accounting_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from accounting_users
  where auth_user_id = auth.uid()
    and active = true
  limit 1;
$$;

create policy accounting_users_read_self
  on accounting_users for select
  using (auth_user_id = auth.uid() or accounting_current_role() = 'owner');

create policy accounting_users_manage_owner
  on accounting_users for all
  using (accounting_current_role() = 'owner')
  with check (accounting_current_role() = 'owner');

create policy accounting_income_read
  on accounting_income for select
  using (accounting_current_user_id() is not null);

create policy accounting_income_write
  on accounting_income for insert
  with check (
    accounting_current_role() in ('owner', 'accountant')
  );

create policy accounting_income_update
  on accounting_income for update
  using (accounting_current_role() in ('owner', 'accountant'));

create policy accounting_income_delete
  on accounting_income for delete
  using (accounting_current_role() = 'owner');

create policy accounting_expenses_read
  on accounting_expenses for select
  using (accounting_current_user_id() is not null);

create policy accounting_expenses_write
  on accounting_expenses for insert
  with check (
    accounting_current_role() in ('owner', 'accountant')
  );

create policy accounting_expenses_update
  on accounting_expenses for update
  using (accounting_current_role() in ('owner', 'accountant'));

create policy accounting_expenses_delete
  on accounting_expenses for delete
  using (accounting_current_role() = 'owner');

create policy accounting_logbook_read
  on accounting_logbook_entries for select
  using (accounting_current_user_id() is not null);

create policy accounting_logbook_write
  on accounting_logbook_entries for insert
  with check (
    accounting_current_role() in ('owner', 'accountant')
  );

create policy accounting_logbook_update
  on accounting_logbook_entries for update
  using (accounting_current_role() in ('owner', 'accountant'));

create policy accounting_logbook_delete
  on accounting_logbook_entries for delete
  using (accounting_current_role() in ('owner', 'accountant'));

-- Storage bucket for expense receipts (create in Supabase dashboard or via API):
-- bucket id: accounting-receipts, private, RLS paths: receipts/{user_id}/...
