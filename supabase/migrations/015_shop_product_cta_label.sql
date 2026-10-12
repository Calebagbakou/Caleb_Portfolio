alter table public.products
  add column if not exists cta_label text not null default 'Acheter maintenant';
