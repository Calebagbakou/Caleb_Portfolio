-- Reuse the existing products, product_plans, categories, customers, orders,
-- order_items, and settings tables; add only the fields needed by the shop.
alter table public.products
  add column if not exists avatar text,
  add column if not exists gradient text,
  add column if not exists image_url text;

alter table public.product_plans
  add column if not exists slug text,
  add column if not exists active boolean not null default true;

update public.product_plans
set slug = trim(both '-' from regexp_replace(lower(label), '[^a-z0-9]+', '-', 'g'))
where slug is null or slug = '';

alter table public.orders
  add column if not exists currency text not null default 'XOF',
  add column if not exists payment_provider text,
  add column if not exists payment_transaction_id text,
  add column if not exists payment_verified_at timestamptz,
  add column if not exists fulfillment_status text not null default 'en_attente';

create unique index if not exists orders_payment_transaction_id_unique
  on public.orders (payment_transaction_id)
  where payment_transaction_id is not null;

-- A public checkout must not be able to create arbitrary orders or customer data.
-- The Edge Functions use the service role after validating the catalog and payment.
drop policy if exists "orders: création publique (checkout)" on public.orders;
drop policy if exists "order_items: création publique (checkout)" on public.order_items;
drop policy if exists "customers: création publique (commande)" on public.customers;

with shop_categories (slug, label, sort_order) as (
  values
    ('ia', 'Intelligence artificielle', 10),
    ('logiciels', 'Logiciels créatifs', 20)
)
insert into public.categories (id, scope, slug, label, sort_order)
select gen_random_uuid(), 'boutique', seed.slug, seed.label, seed.sort_order
from shop_categories as seed
where not exists (
  select 1
  from public.categories as category
  where category.scope = 'boutique' and category.slug = seed.slug
);

with shop_products
  (slug, name, description, tagline, highlights, category_slug, badge, featured, sort_order, avatar, gradient) as (
  values
    (
      'gemini-pro',
      'Gemini Pro',
      'Accès complet à Gemini Pro : génération de texte, d''images, d''analyses et d''assistance avancée. Idéal pour la création de contenu, la recherche et la productivité au quotidien.',
      'L''assistant IA avancé de Google, en illimité.',
      array['Accès aux modèles Gemini les plus avancés', 'Utilisation illimitée pendant la durée choisie', 'Activation rapide après commande'],
      'ia',
      'Populaire',
      true,
      10,
      'Ge',
      'linear-gradient(135deg,#4285F4,#34A853)'
    ),
    (
      'capcut-pro',
      'CapCut Pro',
      'Débloque toutes les fonctionnalités premium de CapCut, à vie : effets, modèles, suppression du filigrane et export en haute qualité pour tes vidéos et contenus réseaux sociaux.',
      'Montage vidéo pro, sans filigrane ni limites — à vie.',
      array['Toutes les fonctionnalités premium débloquées', 'Export sans filigrane', 'Accès à vie, sans renouvellement'],
      'logiciels',
      'À vie',
      true,
      20,
      'Cc',
      'linear-gradient(135deg,#000000,#333333)'
    ),
    (
      'canva-pro',
      'Canva Pro',
      'Accède à l''ensemble des outils Canva Pro : modèles premium, suppression d''arrière-plan, kit de marque, redimensionnement magique et bien plus, pour créer des visuels professionnels rapidement.',
      'Toute la puissance de Canva Pro pendant 1 an.',
      array['Modèles et éléments premium illimités', 'Suppression d''arrière-plan en un clic', 'Kit de marque et redimensionnement magique'],
      'logiciels',
      null,
      true,
      30,
      'Ca',
      'linear-gradient(135deg,#8B3DFF,#00C4CC)'
    )
)
insert into public.products
  (id, name, slug, description, tagline, highlights, category_id, badge, status, featured, sort_order, avatar, gradient, image_url, created_at, updated_at)
select gen_random_uuid(), seed.name, seed.slug, seed.description, seed.tagline, seed.highlights,
  category.id, seed.badge, 'active', seed.featured, seed.sort_order, seed.avatar, seed.gradient, null, now(), now()
from shop_products as seed
join public.categories as category
  on category.scope = 'boutique' and category.slug = seed.category_slug
where not exists (
  select 1 from public.products as product where product.slug = seed.slug
);

with shop_plans (product_slug, slug, label, price, sort_order) as (
  values
    ('gemini-pro', '4mois', '4 mois', 2000, 10),
    ('gemini-pro', '12mois', '12 mois', 4000, 20),
    ('gemini-pro', '18mois', '18 mois', 6000, 30),
    ('capcut-pro', 'avie', 'À vie', 1500, 10),
    ('canva-pro', '1an', '1 an', 2000, 10)
)
insert into public.product_plans
  (id, product_id, slug, label, price, old_price, currency, sort_order, active)
select gen_random_uuid(), product.id, seed.slug, seed.label, seed.price, null, 'XOF', seed.sort_order, true
from shop_plans as seed
join public.products as product on product.slug = seed.product_slug
where not exists (
  select 1 from public.product_plans as plan
  where plan.product_id = product.id and plan.slug = seed.slug
);

insert into public.settings (key, value)
select seed.key, to_jsonb(seed.value)
from (
  values
    ('shop_hero_title', 'Des outils IA et créatifs premium, activés rapidement.'),
    ('shop_hero_description', 'Abonnements Gemini Pro, CapCut Pro, Canva Pro et plus — sélectionnés par Caleb Creative, activés après commande, avec un accompagnement direct.'),
    ('shop_activation_title', 'Activation rapide'),
    ('shop_activation_description', 'Sous 24 à 48h après commande'),
    ('shop_contact_title', 'Suivi par WhatsApp'),
    ('shop_contact_description', 'Un échange direct, sans robot'),
    ('shop_payment_title', 'Paiement local'),
    ('shop_payment_description', 'Paiement sécurisé par KKiaPay')
) as seed(key, value)
where not exists (
  select 1 from public.settings as setting where setting.key = seed.key
);

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

    select plan.id, plan.product_id, plan.label, plan.price, plan.currency
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
    select plan.id, plan.product_id, plan.label, plan.price, plan.currency, product.name
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
