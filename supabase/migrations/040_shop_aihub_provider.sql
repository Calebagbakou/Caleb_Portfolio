alter table public.products
  drop constraint if exists products_active_api_provider_check,
  add constraint products_active_api_provider_check
    check (active_api_provider in ('prodseller', 'zfourstore', 'aihub'));

alter table public.product_plans
  drop constraint if exists product_plans_active_api_provider_check,
  add constraint product_plans_active_api_provider_check
    check (active_api_provider in ('prodseller', 'zfourstore', 'aihub'));

alter table public.shop_provider_settings
  drop constraint if exists shop_provider_settings_active_provider_check,
  add constraint shop_provider_settings_active_provider_check
    check (active_provider in ('prodseller', 'zfourstore', 'aihub'));

alter table public.shop_provider_runtime
  drop constraint if exists shop_provider_runtime_provider_check,
  add constraint shop_provider_runtime_provider_check
    check (provider in ('prodseller', 'zfourstore', 'aihub'));

alter table public.shop_provider_events
  drop constraint if exists shop_provider_events_provider_check,
  add constraint shop_provider_events_provider_check
    check (provider in ('prodseller', 'zfourstore', 'aihub', 'pixverify'));

alter table public.shop_provider_switch_log
  drop constraint if exists shop_provider_switch_log_from_provider_check,
  drop constraint if exists shop_provider_switch_log_to_provider_check,
  add constraint shop_provider_switch_log_from_provider_check
    check (from_provider in ('prodseller', 'zfourstore', 'aihub', 'pixverify')),
  add constraint shop_provider_switch_log_to_provider_check
    check (to_provider in ('prodseller', 'zfourstore', 'aihub', 'pixverify'));

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
  if p_provider is null or p_provider not in ('prodseller', 'zfourstore', 'aihub') then
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

create or replace function public.set_shop_product_provider(
  p_product_id uuid,
  p_provider text,
  p_reason text default null
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  current_provider text;
  updated_product public.products;
begin
  if not public.is_admin() then
    raise exception 'Accès administrateur requis.' using errcode = '42501';
  end if;
  if p_provider is null or p_provider not in ('prodseller', 'zfourstore', 'aihub') then
    raise exception 'Fournisseur invalide.' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.shop_provider_runtime
    where provider = p_provider and is_configured
  ) then
    raise exception 'Le fournisseur sélectionné n’est pas configuré côté serveur.' using errcode = '55000';
  end if;

  select active_api_provider
  into current_provider
  from public.products
  where id = p_product_id and delivery_type = 'api'
  for update;

  if not found then
    raise exception 'Produit API introuvable.' using errcode = '22023';
  end if;
  if p_provider = 'prodseller' and not exists (
      select 1 from public.products
      where id = p_product_id and nullif(trim(prodseller_product_id), '') is not null
    )
    or p_provider = 'zfourstore' and not exists (
      select 1 from public.products
      where id = p_product_id and nullif(trim(zfourstore_product_id), '') is not null
    )
    or p_provider = 'aihub' and not exists (
      select 1 from public.product_plans
      where product_id = p_product_id
        and active_api_provider = 'aihub'
        and nullif(trim(provider_product_id), '') is not null
    ) then
    raise exception 'Ce produit ne possède pas d’identifiant chez le fournisseur sélectionné.' using errcode = '22023';
  end if;

  update public.products
  set active_api_provider = p_provider,
      updated_at = now()
  where id = p_product_id
  returning * into updated_product;

  if current_provider <> p_provider then
    insert into public.shop_provider_switch_log (
      target_key, from_provider, to_provider, changed_by, reason
    ) values (
      p_product_id::text,
      coalesce(current_provider, 'prodseller'),
      p_provider,
      auth.uid(),
      nullif(left(trim(coalesce(p_reason, '')), 500), '')
    );
  end if;

  return updated_product;
end;
$$;

revoke all on function public.set_shop_product_provider(uuid, text, text) from public, anon;
grant execute on function public.set_shop_product_provider(uuid, text, text) to authenticated;
