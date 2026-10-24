alter table public.shop_provider_settings
  drop constraint if exists shop_provider_settings_target_key_check,
  drop constraint if exists shop_provider_settings_active_provider_check;

update public.shop_provider_settings
set active_provider = 'prodseller'
where active_provider = 'pixverify';

update public.shop_provider_settings
set target_key = 'all_api'
where target_key = 'gemini_18m'
  and not exists (
    select 1 from public.shop_provider_settings where target_key = 'all_api'
  );

delete from public.shop_provider_settings where target_key = 'gemini_18m';

alter table public.shop_provider_settings
  add constraint shop_provider_settings_target_key_check
    check (target_key = 'all_api'),
  add constraint shop_provider_settings_active_provider_check
    check (active_provider in ('prodseller', 'zfourstore'));

insert into public.shop_provider_settings (target_key, active_provider)
values ('all_api', 'prodseller')
on conflict (target_key) do nothing;

alter table public.shop_provider_switch_log
  drop constraint if exists shop_provider_switch_log_target_key_check,
  drop constraint if exists shop_provider_switch_log_from_provider_check,
  drop constraint if exists shop_provider_switch_log_to_provider_check,
  add constraint shop_provider_switch_log_target_key_check
    check (target_key in ('gemini_18m', 'all_api')),
  add constraint shop_provider_switch_log_from_provider_check
    check (from_provider in ('prodseller', 'zfourstore', 'pixverify')),
  add constraint shop_provider_switch_log_to_provider_check
    check (to_provider in ('prodseller', 'zfourstore', 'pixverify'));

delete from public.shop_provider_runtime where provider = 'pixverify';
alter table public.shop_provider_runtime
  drop constraint if exists shop_provider_runtime_provider_check,
  add constraint shop_provider_runtime_provider_check
    check (provider in ('prodseller', 'zfourstore'));

alter table public.shop_provider_events
  drop constraint if exists shop_provider_events_target_key_check,
  drop constraint if exists shop_provider_events_provider_check,
  add constraint shop_provider_events_target_key_check
    check (target_key in ('gemini_18m', 'canva_pro', 'duolingo_super_12m')),
  add constraint shop_provider_events_provider_check
    check (provider in ('prodseller', 'zfourstore', 'pixverify'));

create table if not exists public.shop_provider_order_claims (
  activation_id uuid not null references public.gemini_pro_activations(id) on delete cascade,
  target_key text not null
    check (target_key in ('gemini_18m', 'canva_pro', 'duolingo_super_12m')),
  provider text not null check (provider = 'zfourstore'),
  status text not null default 'submitting'
    check (status in ('submitting', 'submitted', 'released')),
  provider_order_id text,
  updated_at timestamptz not null default now(),
  primary key (activation_id, target_key)
);

alter table public.shop_provider_order_claims enable row level security;
revoke all on public.shop_provider_order_claims from anon, authenticated;
grant select, insert, update on public.shop_provider_order_claims to service_role;

create or replace function public.claim_shop_provider_order(
  p_activation_id uuid,
  p_target_key text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean;
begin
  insert into public.shop_provider_order_claims (activation_id, target_key, provider, status)
  values (p_activation_id, p_target_key, 'zfourstore', 'submitting')
  on conflict (activation_id, target_key) do update
    set provider = 'zfourstore',
        status = 'submitting',
        provider_order_id = null,
        updated_at = now()
    where shop_provider_order_claims.status = 'released'
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

revoke all on function public.claim_shop_provider_order(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_shop_provider_order(uuid, text) to service_role;

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
  if p_target <> 'all_api' then
    raise exception 'Cible fournisseur invalide.' using errcode = '22023';
  end if;
  if p_provider not in ('prodseller', 'zfourstore') then
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
