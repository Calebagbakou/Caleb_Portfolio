alter table public.products
  add column if not exists prodseller_product_id text,
  add column if not exists zfourstore_product_id text,
  add column if not exists active_api_provider text not null default 'prodseller';

alter table public.products
  drop constraint if exists products_active_api_provider_check,
  add constraint products_active_api_provider_check
    check (active_api_provider in ('prodseller', 'zfourstore'));

update public.products
set active_api_provider = coalesce(
  (select setting.active_provider
   from public.shop_provider_settings as setting
   where setting.target_key = 'all_api'),
  'prodseller'
)
where delivery_type = 'api';

alter table public.shop_provider_switch_log
  drop constraint if exists shop_provider_switch_log_target_key_check,
  add constraint shop_provider_switch_log_target_key_check
    check (length(trim(target_key)) > 0);

alter table public.shop_provider_events
  drop constraint if exists shop_provider_events_target_key_check,
  add constraint shop_provider_events_target_key_check
    check (length(trim(target_key)) > 0);

alter table public.shop_provider_order_claims
  drop constraint if exists shop_provider_order_claims_target_key_check;

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
  if p_provider is null or p_provider not in ('prodseller', 'zfourstore') then
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
  if (p_provider = 'prodseller' and not exists (
      select 1 from public.products
      where id = p_product_id and nullif(trim(prodseller_product_id), '') is not null
    ))
    or (p_provider = 'zfourstore' and not exists (
      select 1 from public.products
      where id = p_product_id and nullif(trim(zfourstore_product_id), '') is not null
    )) then
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
