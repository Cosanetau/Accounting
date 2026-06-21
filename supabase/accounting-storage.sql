-- COSA Accounting receipt storage
-- Run after accounting-schema.sql

insert into storage.buckets (id, name, public)
values ('accounting-receipts', 'accounting-receipts', false)
on conflict (id) do nothing;

drop policy if exists "Accounting users can upload receipts" on storage.objects;
drop policy if exists "Accounting users can read receipts" on storage.objects;

create policy "Accounting users can upload receipts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'accounting-receipts'
  and (storage.foldername(name))[1] = 'receipts'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1
    from accounting_users
    where auth_user_id = auth.uid()
      and active = true
  )
);

create policy "Accounting users can read receipts"
on storage.objects for select to authenticated
using (
  bucket_id = 'accounting-receipts'
  and exists (
    select 1
    from accounting_users
    where auth_user_id = auth.uid()
      and active = true
  )
);
