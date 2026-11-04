alter table public.product_plans
  add column if not exists active_api_provider text not null default 'prodseller',
  add column if not exists provider_product_id text;

alter table public.product_plans
  drop constraint if exists product_plans_active_api_provider_check,
  add constraint product_plans_active_api_provider_check
    check (active_api_provider in ('prodseller', 'zfourstore'));

update public.product_plans as plan
set active_api_provider = case
      when product.active_api_provider in ('prodseller', 'zfourstore') then product.active_api_provider
      else 'prodseller'
    end,
    provider_product_id = case
      when (
        (product.slug = 'gemini-pro' and plan.slug = '18mois')
        or (product.slug = 'canva-pro' and plan.slug = '1an')
        or (product.slug = 'duolingo-super' and plan.slug = '12mois')
        or (
          select count(*) = 1
          from public.product_plans as sibling_plan
          where sibling_plan.product_id = plan.product_id
        )
      ) and product.active_api_provider = 'zfourstore'
        then nullif(trim(product.zfourstore_product_id), '')
      when (
        (product.slug = 'gemini-pro' and plan.slug = '18mois')
        or (product.slug = 'canva-pro' and plan.slug = '1an')
        or (product.slug = 'duolingo-super' and plan.slug = '12mois')
        or (
          select count(*) = 1
          from public.product_plans as sibling_plan
          where sibling_plan.product_id = plan.product_id
        )
      )
        then nullif(trim(product.prodseller_product_id), '')
      else null
    end
from public.products as product
where product.id = plan.product_id;

update public.products
set regular_price = null,
    promo_price = null
where regular_price is not null or promo_price is not null;
