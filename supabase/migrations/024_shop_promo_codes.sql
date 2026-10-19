create table if not exists public.shop_promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(12, 2) not null check (discount_value > 0),
  active boolean not null default true,
  starts_at timestamptz,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_promo_codes_code_format check (code = upper(btrim(code)) and code ~ '^[A-Z0-9_-]{3,40}$'),
  constraint shop_promo_codes_discount_value check (
    (discount_type = 'percentage' and discount_value <= 100)
    or (discount_type = 'fixed' and discount_value = trunc(discount_value))
  ),
  constraint shop_promo_codes_date_range check (expires_at is null or starts_at is null or expires_at > starts_at)
);

alter table public.shop_promo_codes enable row level security;
revoke all on public.shop_promo_codes from anon, authenticated;
grant select, insert, update, delete on public.shop_promo_codes to authenticated;

drop policy if exists "shop promo codes: admin read" on public.shop_promo_codes;
create policy "shop promo codes: admin read"
  on public.shop_promo_codes for select to authenticated
  using (public.is_admin());

drop policy if exists "shop promo codes: admin insert" on public.shop_promo_codes;
create policy "shop promo codes: admin insert"
  on public.shop_promo_codes for insert to authenticated
  with check (public.is_admin());

drop policy if exists "shop promo codes: admin update" on public.shop_promo_codes;
create policy "shop promo codes: admin update"
  on public.shop_promo_codes for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "shop promo codes: admin delete" on public.shop_promo_codes;
create policy "shop promo codes: admin delete"
  on public.shop_promo_codes for delete to authenticated
  using (public.is_admin());

alter table public.orders
  add column if not exists promo_code text,
  add column if not exists promo_discount numeric(12, 2) not null default 0
    check (promo_discount >= 0);

drop function if exists public.create_shop_order(jsonb, jsonb, text);

create function public.create_shop_order(
  p_customer jsonb,
  p_items jsonb,
  p_note text default null,
  p_promo_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid := gen_random_uuid();
  v_order_id uuid := gen_random_uuid();
  v_ref text := 'CC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  v_subtotal numeric(12, 2) := 0;
  v_discount numeric(12, 2) := 0;
  v_total numeric(12, 2) := 0;
  v_promo_code text := nullif(upper(btrim(p_promo_code)), '');
  v_promo public.shop_promo_codes%rowtype;
  v_paid_by_promo boolean := false;
  v_line record;
  v_plan record;
  v_name text;
  v_contact text;
  v_email text;
  v_order_items jsonb;
begin
  v_name := nullif(trim(p_customer->>'name'), '');
  v_contact := nullif(trim(p_customer->>'contact'), '');
  v_email := nullif(trim(p_customer->>'email'), '');

  if v_name is null or v_contact is null then
    raise exception 'Nom et téléphone sont obligatoires.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Le panier est vide.';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Le panier contient trop de lignes.';
  end if;

  for v_line in
    select item.product_id, item.plan_id, item.qty
    from jsonb_to_recordset(p_items) as item(product_id uuid, plan_id uuid, qty integer)
  loop
    if v_line.qty is null or v_line.qty < 1 or v_line.qty > 20 then
      raise exception 'Quantité invalide.';
    end if;

    select plan.id, plan.product_id, plan.label,
      coalesce(product.promo_price, plan.price) as price,
      plan.currency
    into v_plan
    from public.product_plans as plan
    join public.products as product on product.id = plan.product_id
    where plan.id = v_line.plan_id
      and plan.product_id = v_line.product_id
      and plan.active
      and product.status = 'active';

    if not found then
      raise exception 'Un produit ou une formule n''est plus disponible.';
    end if;
    if v_plan.currency <> 'XOF' then
      raise exception 'La devise de la formule n''est pas encore prise en charge.';
    end if;
    if v_plan.price is null or v_plan.price <= 0 then
      raise exception 'Le prix promotionnel du produit doit être supérieur à zéro.';
    end if;

    v_subtotal := v_subtotal + (v_plan.price * v_line.qty);
  end loop;

  if v_subtotal <= 0 then
    raise exception 'Le montant du panier doit être supérieur à zéro avant réduction.';
  end if;

  if v_promo_code is not null then
    select * into v_promo
    from public.shop_promo_codes
    where code = v_promo_code
      and active
      and (starts_at is null or starts_at <= now())
      and (expires_at is null or expires_at > now())
    for update;

    if not found then
      raise exception 'Code promo invalide, inactif ou expiré.';
    end if;

    if v_promo.discount_type = 'percentage' then
      v_discount := round(v_subtotal * v_promo.discount_value / 100, 0);
    else
      v_discount := v_promo.discount_value;
    end if;
    v_discount := least(v_subtotal, v_discount);
  end if;

  v_total := greatest(0, v_subtotal - v_discount);
  v_paid_by_promo := v_total = 0 and v_discount > 0;

  insert into public.customers (id, name, contact, email, created_at)
  values (v_customer_id, v_name, v_contact, v_email, now());

  insert into public.orders
    (id, ref, customer_id, status, payment_method, payment_status, total, note,
     created_at, currency, payment_provider, fulfillment_status, payment_verified_at,
     promo_code, promo_discount)
  values
    (v_order_id, v_ref, v_customer_id, 'en_attente',
     case when v_paid_by_promo then 'promo' else 'saspay' end,
     case when v_paid_by_promo then 'confirme' else 'non_confirme' end,
     v_total, nullif(trim(p_note), ''), now(), 'XOF',
     case when v_paid_by_promo then 'promo' else 'saspay' end,
     'en_attente', case when v_paid_by_promo then now() else null end,
     v_promo_code, v_discount);

  for v_line in
    select item.product_id, item.plan_id, item.qty
    from jsonb_to_recordset(p_items) as item(product_id uuid, plan_id uuid, qty integer)
  loop
    select plan.id, plan.product_id, plan.label,
      coalesce(product.promo_price, plan.price) as price,
      plan.currency, product.name
    into v_plan
    from public.product_plans as plan
    join public.products as product on product.id = plan.product_id
    where plan.id = v_line.plan_id
      and plan.product_id = v_line.product_id
      and plan.active
      and product.status = 'active';

    insert into public.order_items
      (id, order_id, product_id, plan_id, product_name, plan_label, unit_price, qty, line_total)
    values
      (gen_random_uuid(), v_order_id, v_plan.product_id, v_plan.id, v_plan.name,
       v_plan.label, v_plan.price, v_line.qty, v_plan.price * v_line.qty);
  end loop;

  select jsonb_agg(jsonb_build_object(
    'productId', item.product_id,
    'planId', item.plan_id,
    'name', item.product_name,
    'planLabel', item.plan_label,
    'unitPrice', item.unit_price,
    'qty', item.qty,
    'lineTotal', item.line_total
  ) order by item.id)
  into v_order_items
  from public.order_items as item
  where item.order_id = v_order_id;

  return jsonb_build_object(
    'id', v_order_id,
    'ref', v_ref,
    'subtotal', v_subtotal,
    'discountAmount', v_discount,
    'promoCode', v_promo_code,
    'total', v_total,
    'currency', 'XOF',
    'payment_status', case when v_paid_by_promo then 'confirme' else 'non_confirme' end,
    'payment_method', case when v_paid_by_promo then 'promo' else null end,
    'payment_verified_at', case when v_paid_by_promo then now() else null end,
    'created_at', now(),
    'customer', jsonb_build_object('name', v_name, 'contact', v_contact, 'email', v_email),
    'items', coalesce(v_order_items, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.create_shop_order(jsonb, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.create_shop_order(jsonb, jsonb, text, text) to service_role;
