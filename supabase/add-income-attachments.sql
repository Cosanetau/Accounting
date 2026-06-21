-- Add receipt/attachment fields to income sales
alter table accounting_income
  add column if not exists receipt_path text,
  add column if not exists receipt_filename text;

-- Allow income attachments in the same bucket as expense receipts
drop policy if exists "Accounting users can upload receipts" on storage.objects;

create policy "Accounting users can upload receipts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'accounting-receipts'
  and (storage.foldername(name))[1] in ('receipts', 'income')
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1
    from accounting_users
    where auth_user_id = auth.uid()
      and active = true
  )
);
