create table if not exists public.admin_customer_notes (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  note text not null check (char_length(note) <= 3000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.admin_customer_notes enable row level security;
revoke all on public.admin_customer_notes from anon, authenticated;
grant select, insert, update, delete on public.admin_customer_notes to authenticated;

drop policy if exists "admin customer notes: administration" on public.admin_customer_notes;
create policy "admin customer notes: administration"
  on public.admin_customer_notes
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
