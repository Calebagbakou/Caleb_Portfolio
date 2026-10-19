alter table public.gemini_pro_activations
  add column if not exists provider text,
  add column if not exists provider_data jsonb;

comment on column public.gemini_pro_activations.provider_data is
  'Private provider order and delivery data; accessed by the service Edge Function.';
