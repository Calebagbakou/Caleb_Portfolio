update public.products
set delivery_type = 'api',
    access_url = null
where slug in ('gemini-pro', 'canva-pro');

delete from public.product_deliveries
where product_id in (
  select id
  from public.products
  where slug in ('gemini-pro', 'canva-pro')
);
