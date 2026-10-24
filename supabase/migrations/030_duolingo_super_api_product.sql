with inserted_category as (
  insert into public.categories (id, scope, slug, label, sort_order)
  select gen_random_uuid(), 'boutique', 'education', 'Langues et apprentissage', 30
  where not exists (
    select 1
    from public.categories
    where scope = 'boutique' and slug = 'education'
  )
  returning id
),
category as (
  select id from inserted_category
  union
  select id
  from public.categories
  where scope = 'boutique' and slug = 'education'
  limit 1
)
insert into public.products
  (id, name, slug, description, tagline, highlights, category_id, badge, status,
   featured, sort_order, avatar, gradient, image_url, delivery_type, access_url,
   created_at, updated_at)
select
  gen_random_uuid(),
  'Duolingo Super',
  'duolingo-super',
  'Profite de Duolingo Super pendant 12 mois pour apprendre une langue sans publicité et avec des fonctionnalités premium.',
  'Apprends une nouvelle langue pendant 12 mois.',
  array['Abonnement Duolingo Super pendant 12 mois', 'Apprentissage sans publicité', 'Activation après confirmation du paiement'],
  category.id,
  null,
  'active',
  false,
  40,
  'Du',
  'linear-gradient(135deg,#58CC02,#89E219)',
  null,
  'api',
  null,
  now(),
  now()
from category
where not exists (
  select 1 from public.products where slug = 'duolingo-super'
);

update public.products
set delivery_type = 'api',
    access_url = null,
    updated_at = now()
where slug = 'duolingo-super';

delete from public.product_deliveries
where product_id in (
  select id from public.products where slug = 'duolingo-super'
);

insert into public.product_plans
  (id, product_id, slug, label, price, old_price, currency, sort_order, active)
select
  gen_random_uuid(),
  product.id,
  '12mois',
  '12 mois',
  1000,
  null,
  'XOF',
  10,
  true
from public.products as product
where product.slug = 'duolingo-super'
  and not exists (
    select 1 from public.product_plans as plan
    where plan.product_id = product.id and plan.slug = '12mois'
  );
