-- Keep file links private and issue short-lived delivery tokens after payment.
alter table public.products
  add column if not exists delivery_type text not null default 'activate',
  add column if not exists download_filename text,
  add column if not exists download_size text;

alter table public.products
  drop constraint if exists products_delivery_type_check,
  add constraint products_delivery_type_check
    check (delivery_type in ('download', 'activate', 'api'));

create table if not exists public.product_deliveries (
  product_id uuid primary key references public.products(id) on delete cascade,
  access_url text not null,
  updated_at timestamptz not null default now()
);

alter table public.product_deliveries enable row level security;
revoke all on public.product_deliveries from anon;
grant select, insert, update, delete on public.product_deliveries to authenticated, service_role;

drop policy if exists "product deliveries: administration" on public.product_deliveries;
create policy "product deliveries: administration"
  on public.product_deliveries
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

insert into public.product_deliveries (product_id, access_url)
select id, access_url
from public.products
where nullif(trim(access_url), '') is not null
on conflict (product_id) do update
set access_url = excluded.access_url,
    updated_at = now();

update public.products
set delivery_type = case slug
      when 'capcut-pro' then 'download'
      when 'gemini-pro' then 'api'
      else 'activate'
    end,
    access_url = null;

create table if not exists public.shop_download_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists shop_download_tokens_order_product_idx
  on public.shop_download_tokens (order_id, product_id);
create index if not exists shop_download_tokens_expiry_idx
  on public.shop_download_tokens (expires_at);

alter table public.shop_download_tokens enable row level security;
revoke all on public.shop_download_tokens from anon, authenticated;
grant all on public.shop_download_tokens to service_role;
