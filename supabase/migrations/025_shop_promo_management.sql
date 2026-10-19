alter table public.shop_promo_codes
  add column name text,
  add column is_gift boolean not null default false,
  add column product_ids uuid[] not null default '{}',
  add column max_uses integer default 100,
  add column uses_count integer not null default 0,
  add column max_uses_per_email integer default 1;

alter table public.orders
  add column promo_code_id uuid references public.shop_promo_codes(id) on delete set null;

update public.shop_promo_codes
set name = code,
    is_gift = discount_type = 'percentage' and discount_value = 100;

update public.orders as orders
set promo_code_id = promo.id
from public.shop_promo_codes as promo
where orders.promo_code = promo.code
  and orders.promo_code_id is null;

update public.shop_promo_codes as promo
set uses_count = (
  select count(*)::integer
  from public.orders as orders
  where orders.promo_code_id = promo.id
);

update public.shop_promo_codes
set active = false
where uses_count >= max_uses;

alter table public.shop_promo_codes
  alter column name set not null,
  add constraint shop_promo_codes_name_length
    check (char_length(btrim(name)) between 1 and 120),
  add constraint shop_promo_codes_max_uses_positive
    check (max_uses >= 1),
  add constraint shop_promo_codes_uses_count_nonnegative
    check (uses_count >= 0),
  add constraint shop_promo_codes_max_uses_per_email_positive
    check (max_uses_per_email >= 1),
  add constraint shop_promo_codes_product_ids_no_nulls
    check (array_position(product_ids, null) is null),
  add constraint shop_promo_codes_full_discount_is_gift
    check (discount_type <> 'percentage' or discount_value <> 100 or is_gift);

create index orders_promo_code_customer_idx
  on public.orders (promo_code_id, customer_id)
  where promo_code_id is not null;

create or replace function public.enforce_shop_promo_use_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.max_uses is not null and new.uses_count >= new.max_uses then
    new.active := false;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger shop_promo_codes_enforce_use_limit
before insert or update on public.shop_promo_codes
for each row execute function public.enforce_shop_promo_use_limit();

create or replace function public.calculate_shop_order_quote(
  p_items jsonb,
  p_promo_code text default null,
  p_email text default null,
  p_lock_promo boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal numeric(12, 2) := 0;
  v_discountable_subtotal numeric(12, 2) := 0;
  v_discount numeric(12, 2) := 0;
  v_total numeric(12, 2) := 0;
  v_promo_code text := nullif(upper(btrim(p_promo_code)), '');
  v_email text := nullif(lower(btrim(p_email)), '');
  v_promo public.shop_promo_codes%rowtype;
  v_email_uses bigint := 0;
  v_order_items jsonb := '[]'::jsonb;
  v_line record;
  v_plan record;
  v_item jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = 'P0001', message = 'Le panier est vide ou invalide.';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception using errcode = 'P0001', message = 'Le panier contient trop de lignes.';
  end if;

  for v_line in
    select item.product_id, item.plan_id, item.qty
    from jsonb_to_recordset(p_items) as item(product_id uuid, plan_id uuid, qty integer)
  loop
    if v_line.qty is null or v_line.qty < 1 or v_line.qty > 20 then
      raise exception using errcode = 'P0001', message = 'Quantité invalide.';
    end if;

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

    if not found then
      raise exception using errcode = 'P0001', message = 'Un produit ou une formule n''est plus disponible.';
    end if;
    if v_plan.currency <> 'XOF' then
      raise exception using errcode = 'P0001', message = 'La devise de la formule n''est pas encore prise en charge.';
    end if;
    if v_plan.price is null or v_plan.price <= 0 then
      raise exception using errcode = 'P0001', message = 'Le prix promotionnel du produit doit être supérieur à zéro.';
    end if;

    v_subtotal := v_subtotal + (v_plan.price * v_line.qty);
    v_order_items := v_order_items || jsonb_build_array(jsonb_build_object(
      'productId', v_plan.product_id,
      'planId', v_plan.id,
      'name', v_plan.name,
      'planLabel', v_plan.label,
      'unitPrice', v_plan.price,
      'qty', v_line.qty,
      'lineTotal', v_plan.price * v_line.qty
    ));
  end loop;

  if v_subtotal <= 0 then
    raise exception using errcode = 'P0001', message = 'Le montant du panier doit être supérieur à zéro avant réduction.';
  end if;

  if v_promo_code is not null then
    if p_lock_promo then
      select * into v_promo
      from public.shop_promo_codes
      where code = v_promo_code
      for update;
    else
      select * into v_promo
      from public.shop_promo_codes
      where code = v_promo_code;
    end if;

    if not found then
      raise exception using errcode = 'P0001', message = 'Code promo invalide, inactif ou expiré.';
    end if;
    if v_promo.max_uses is not null and v_promo.uses_count >= v_promo.max_uses then
      raise exception using errcode = 'P0001', message = 'Ce code promo a atteint sa limite d''utilisation.';
    end if;
    if not v_promo.active
      or (v_promo.starts_at is not null and v_promo.starts_at > now())
      or (v_promo.expires_at is not null and v_promo.expires_at <= now()) then
      raise exception using errcode = 'P0001', message = 'Code promo invalide, inactif ou expiré.';
    end if;
    if v_promo.max_uses_per_email is not null then
      if v_email is null then
        raise exception using errcode = 'P0001', message = 'Une adresse e-mail confirmée est nécessaire pour utiliser ce code promo.';
      end if;
      select count(*) into v_email_uses
      from public.orders as orders
      join public.customers as customers on customers.id = orders.customer_id
      where orders.promo_code_id = v_promo.id
        and lower(btrim(customers.email)) = v_email;
      if v_email_uses >= v_promo.max_uses_per_email then
        raise exception using errcode = 'P0001', message = 'Ce code promo a déjà été utilisé le nombre maximum de fois pour votre adresse e-mail.';
      end if;
    end if;

    select coalesce(sum((item.value->>'lineTotal')::numeric), 0)
    into v_discountable_subtotal
    from jsonb_array_elements(v_order_items) as item(value)
    where cardinality(v_promo.product_ids) = 0
      or (item.value->>'productId')::uuid = any(v_promo.product_ids);

    if v_discountable_subtotal <= 0 then
      raise exception using errcode = 'P0001', message = 'Ce code promo ne s''applique à aucun produit de votre panier.';
    end if;

    if v_promo.discount_type = 'percentage' then
      v_discount := round(v_discountable_subtotal * v_promo.discount_value / 100, 0);
    else
      v_discount := least(v_discountable_subtotal, v_promo.discount_value);
    end if;
    if v_discount > 0 and v_discount >= v_subtotal and not v_promo.is_gift then
      raise exception using errcode = 'P0001', message = 'Cette réduction offrirait la commande entière. Un code cadeau est nécessaire.';
    end if;
  end if;

  v_total := greatest(0, v_subtotal - v_discount);

  return jsonb_build_object(
    'subtotal', v_subtotal,
    'discountAmount', v_discount,
    'promoCode', v_promo_code,
    'total', v_total,
    'currency', 'XOF',
    'items', v_order_items
  );
end;
$$;

create or replace function public.preview_shop_order(
  p_items jsonb,
  p_promo_code text,
  p_email text
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.calculate_shop_order_quote(p_items, p_promo_code, p_email, false);
$$;

drop function if exists public.create_shop_order(jsonb, jsonb, text, text);

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
  v_name text := nullif(trim(p_customer->>'name'), '');
  v_contact text := nullif(trim(p_customer->>'contact'), '');
  v_email text := nullif(lower(trim(p_customer->>'email')), '');
  v_promo_code text := nullif(upper(btrim(p_promo_code)), '');
  v_quote jsonb;
  v_paid_by_promo boolean;
  v_item jsonb;
begin
  if v_name is null or v_contact is null then
    raise exception using errcode = 'P0001', message = 'Nom et téléphone sont obligatoires.';
  end if;

  v_quote := public.calculate_shop_order_quote(p_items, v_promo_code, v_email, true);
  v_paid_by_promo := (v_quote->>'total')::numeric = 0
    and (v_quote->>'discountAmount')::numeric > 0;

  insert into public.customers (id, name, contact, email, created_at)
  values (v_customer_id, v_name, v_contact, v_email, now());

  insert into public.orders
    (id, ref, customer_id, status, payment_method, payment_status, total, note,
     created_at, currency, payment_provider, fulfillment_status, payment_verified_at,
     promo_code, promo_code_id, promo_discount)
  values
    (v_order_id, v_ref, v_customer_id, 'en_attente',
     case when v_paid_by_promo then 'promo' else 'saspay' end,
     case when v_paid_by_promo then 'confirme' else 'non_confirme' end,
     (v_quote->>'total')::numeric, nullif(trim(p_note), ''), now(), 'XOF',
     case when v_paid_by_promo then 'promo' else 'saspay' end,
     'en_attente', case when v_paid_by_promo then now() else null end,
     v_promo_code, (select id from public.shop_promo_codes where code = v_promo_code),
     (v_quote->>'discountAmount')::numeric);

  for v_item in select value from jsonb_array_elements(v_quote->'items')
  loop
    insert into public.order_items
      (id, order_id, product_id, plan_id, product_name, plan_label, unit_price, qty, line_total)
    values
      (gen_random_uuid(), v_order_id, (v_item->>'productId')::uuid, (v_item->>'planId')::uuid,
       v_item->>'name', v_item->>'planLabel', (v_item->>'unitPrice')::numeric,
       (v_item->>'qty')::integer, (v_item->>'lineTotal')::numeric);
  end loop;

  if v_promo_code is not null then
    update public.shop_promo_codes
    set uses_count = uses_count + 1
    where code = v_promo_code;
  end if;

  return v_quote || jsonb_build_object(
    'id', v_order_id,
    'ref', v_ref,
    'payment_status', case when v_paid_by_promo then 'confirme' else 'non_confirme' end,
    'payment_method', case when v_paid_by_promo then 'promo' else null end,
    'payment_verified_at', case when v_paid_by_promo then now() else null end,
    'created_at', now(),
    'customer', jsonb_build_object('name', v_name, 'contact', v_contact, 'email', v_email),
    'items', coalesce(v_quote->'items', '[]'::jsonb)
  );
end;
$$;

revoke all on function public.calculate_shop_order_quote(jsonb, text, text, boolean) from public, anon, authenticated;
revoke all on function public.preview_shop_order(jsonb, text, text) from public, anon, authenticated;
revoke all on function public.create_shop_order(jsonb, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.calculate_shop_order_quote(jsonb, text, text, boolean) to service_role;
grant execute on function public.preview_shop_order(jsonb, text, text) to service_role;
grant execute on function public.create_shop_order(jsonb, jsonb, text, text) to service_role;
