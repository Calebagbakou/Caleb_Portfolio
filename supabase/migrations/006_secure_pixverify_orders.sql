alter table public.gemini_pro_activations
  alter column code drop not null,
  add column if not exists order_id uuid references public.orders(id) on delete cascade,
  add column if not exists generation_id text,
  add column if not exists status text not null default 'starting',
  add column if not exists result_url text;

create unique index if not exists gemini_pro_activations_order_id_unique
  on public.gemini_pro_activations(order_id)
  where order_id is not null;

alter table public.gemini_pro_activations enable row level security;

revoke all on table public.gemini_pro_activations from anon, authenticated;
