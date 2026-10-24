create table if not exists public.shop_provider_settings (
  target_key text primary key check (target_key in ('gemini_18m')),
  active_provider text not null default 'prodseller'
    check (active_provider in ('prodseller', 'pixverify')),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

insert into public.shop_provider_settings (target_key, active_provider)
values ('gemini_18m', 'prodseller')
on conflict (target_key) do nothing;

create table if not exists public.shop_provider_switch_log (
  id uuid primary key default gen_random_uuid(),
  target_key text not null check (target_key in ('gemini_18m')),
  from_provider text not null check (from_provider in ('prodseller', 'pixverify')),
  to_provider text not null check (to_provider in ('prodseller', 'pixverify')),
  changed_by uuid,
  changed_at timestamptz not null default now(),
  reason text
);

create index if not exists shop_provider_switch_log_changed_at_idx
  on public.shop_provider_switch_log (changed_at desc);

create table if not exists public.shop_provider_runtime (
  provider text primary key check (provider in ('prodseller', 'pixverify')),
  is_configured boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_provider_events (
  id uuid primary key default gen_random_uuid(),
  target_key text not null check (target_key in ('gemini_18m')),
  provider text not null check (provider in ('prodseller', 'pixverify')),
  event_type text not null check (event_type in ('out_of_stock', 'insufficient_balance')),
  created_at timestamptz not null default now()
);

create index if not exists shop_provider_events_created_at_idx
  on public.shop_provider_events (created_at desc);

alter table public.shop_provider_settings enable row level security;
alter table public.shop_provider_switch_log enable row level security;
alter table public.shop_provider_runtime enable row level security;
alter table public.shop_provider_events enable row level security;

drop policy if exists "shop provider settings: admin read" on public.shop_provider_settings;
create policy "shop provider settings: admin read"
  on public.shop_provider_settings for select to authenticated
  using (public.is_admin());

drop policy if exists "shop provider switch log: admin read" on public.shop_provider_switch_log;
create policy "shop provider switch log: admin read"
  on public.shop_provider_switch_log for select to authenticated
  using (public.is_admin());

drop policy if exists "shop provider events: admin read" on public.shop_provider_events;
create policy "shop provider events: admin read"
  on public.shop_provider_events for select to authenticated
  using (public.is_admin());

drop policy if exists "shop provider runtime: admin read" on public.shop_provider_runtime;
create policy "shop provider runtime: admin read"
  on public.shop_provider_runtime for select to authenticated
  using (public.is_admin());

revoke all on public.shop_provider_settings from anon, authenticated;
grant select on public.shop_provider_settings to authenticated;
grant select on public.shop_provider_settings to service_role;
revoke all on public.shop_provider_switch_log from anon, authenticated;
grant select on public.shop_provider_switch_log to authenticated;
grant select on public.shop_provider_switch_log to service_role;
revoke all on public.shop_provider_events from anon, authenticated;
grant select on public.shop_provider_events to authenticated;
grant select, insert on public.shop_provider_events to service_role;
revoke all on public.shop_provider_runtime from anon, authenticated;
grant select on public.shop_provider_runtime to authenticated;
grant select, insert, update on public.shop_provider_runtime to service_role;

create or replace function public.set_shop_provider(
  p_target text,
  p_provider text,
  p_reason text default null
)
returns public.shop_provider_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  current_provider text;
  updated_setting public.shop_provider_settings;
begin
  if not public.is_admin() then
    raise exception 'Accès administrateur requis.' using errcode = '42501';
  end if;
  if p_target <> 'gemini_18m' then
    raise exception 'Cible fournisseur invalide.' using errcode = '22023';
  end if;
  if p_provider not in ('prodseller', 'pixverify') then
    raise exception 'Fournisseur invalide.' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.shop_provider_runtime
    where provider = p_provider and is_configured
  ) then
    raise exception 'Le fournisseur sélectionné n’est pas configuré côté serveur.' using errcode = '55000';
  end if;

  select active_provider into current_provider
  from public.shop_provider_settings
  where target_key = p_target
  for update;

  if current_provider is null then
    current_provider := 'prodseller';
    insert into public.shop_provider_settings (target_key, active_provider)
    values (p_target, current_provider)
    on conflict (target_key) do nothing;
    select active_provider into current_provider
    from public.shop_provider_settings
    where target_key = p_target
    for update;
  end if;

  update public.shop_provider_settings
  set active_provider = p_provider,
      updated_by = auth.uid(),
      updated_at = now()
  where target_key = p_target
  returning * into updated_setting;

  if current_provider <> p_provider then
    insert into public.shop_provider_switch_log (
      target_key, from_provider, to_provider, changed_by, reason
    ) values (
      p_target, current_provider, p_provider, auth.uid(), nullif(left(trim(coalesce(p_reason, '')), 500), '')
    );
  end if;

  return updated_setting;
end;
$$;

revoke all on function public.set_shop_provider(text, text, text) from public, anon;
grant execute on function public.set_shop_provider(text, text, text) to authenticated;
