alter table public.products
  add column if not exists download_platform text,
  add column if not exists download_instructions text;
