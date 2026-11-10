with inserted_category as (
  insert into public.categories (id, scope, slug, label, sort_order)
  select gen_random_uuid(), 'boutique', 'formations-en-ligne', 'Formations en ligne', 30
  where not exists (
    select 1
    from public.categories
    where scope = 'boutique' and slug = 'formations-en-ligne'
  )
  returning id
),
category as (
  select id from inserted_category
  union
  select id
  from public.categories
  where scope = 'boutique' and slug = 'formations-en-ligne'
  limit 1
)
insert into public.products
  (id, name, slug, description, tagline, highlights, category_id, badge, status,
   featured, sort_order, avatar, gradient, image_url, delivery_type, access_url,
   zfourstore_product_id, active_api_provider, created_at, updated_at)
select
  gen_random_uuid(),
  'Coursera Premium 12 months',
  'coursera-premium-12-months',
  'Abonnement Coursera Premium pendant 12 mois. La commande est transmise à Zfour après confirmation du paiement.',
  'Accès Coursera Premium pendant 12 mois.',
  array[
    'Abonnement Coursera Premium pendant 12 mois',
    'Activation via Zfour après confirmation du paiement'
  ],
  category.id,
  null,
  'active',
  false,
  50,
  'Co',
  'linear-gradient(135deg,#0056D2,#00A6D6)',
  null,
  'api',
  null,
  '6abc51626712b04cbf110ffa',
  'zfourstore',
  now(),
  now()
from category
where not exists (
  select 1 from public.products where slug = 'coursera-premium-12-months'
);

update public.products
set name = 'Coursera Premium 12 months',
    description = 'Abonnement Coursera Premium pendant 12 mois. La commande est transmise à Zfour après confirmation du paiement.',
    tagline = 'Accès Coursera Premium pendant 12 mois.',
    highlights = array[
      'Abonnement Coursera Premium pendant 12 mois',
      'Activation via Zfour après confirmation du paiement'
    ],
    category_id = (
      select id
      from public.categories
      where scope = 'boutique' and slug = 'formations-en-ligne'
      limit 1
    ),
    status = 'active',
    delivery_type = 'api',
    access_url = null,
    zfourstore_product_id = '6abc51626712b04cbf110ffa',
    active_api_provider = 'zfourstore',
    updated_at = now()
where slug = 'coursera-premium-12-months';

delete from public.product_deliveries
where product_id in (
  select id from public.products where slug = 'coursera-premium-12-months'
);

insert into public.product_plans
  (id, product_id, slug, label, price, old_price, currency, sort_order, active,
   active_api_provider, provider_product_id)
select
  gen_random_uuid(),
  product.id,
  '12mois',
  '12 mois',
  4000,
  null,
  'XOF',
  10,
  true,
  'zfourstore',
  '6abc51626712b04cbf110ffa'
from public.products as product
where product.slug = 'coursera-premium-12-months'
  and not exists (
    select 1 from public.product_plans as plan
    where plan.product_id = product.id and plan.slug = '12mois'
  );

update public.product_plans as plan
set label = '12 mois',
    price = 4000,
    old_price = null,
    currency = 'XOF',
    active = true,
    active_api_provider = 'zfourstore',
    provider_product_id = '6abc51626712b04cbf110ffa'
from public.products as product
where plan.product_id = product.id
  and product.slug = 'coursera-premium-12-months'
  and plan.slug = '12mois';
