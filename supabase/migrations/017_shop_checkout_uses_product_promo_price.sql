create or replace function public.create_shop_order(
  p_customer jsonb,
  p_items jsonb,
  p_note text default null
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
  v_total numeric(12, 2) := 0;
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

    v_total := v_total + (v_plan.price * v_line.qty);
  end loop;

  if v_total <= 0 then
    raise exception 'Le montant de la commande doit être supérieur à zéro.';
  end if;

  insert into public.customers (id, name, contact, email, created_at)
  values (v_customer_id, v_name, v_contact, v_email, now());

  insert into public.orders
    (id, ref, customer_id, status, payment_method, payment_status, total, note,
     created_at, currency, payment_provider, fulfillment_status)
  values
    (v_order_id, v_ref, v_customer_id, 'en_attente', 'kkiapay', 'non_confirme', v_total,
     nullif(trim(p_note), ''), now(), 'XOF', 'kkiapay', 'en_attente');

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
    'total', v_total,
    'currency', 'XOF',
    'customer', jsonb_build_object('name', v_name, 'contact', v_contact, 'email', v_email),
    'items', coalesce(v_order_items, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.create_shop_order(jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_shop_order(jsonb, jsonb, text) to service_role;
