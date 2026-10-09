-- Create table for Gemini Pro activations
create table if not exists public.gemini_pro_activations (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  code text not null unique,
  verified_at timestamptz not null default now(),
  pixverify_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add comment
comment on table public.gemini_pro_activations is
  'Tracks Gemini Pro activation codes and verification from pixverify.shop';

-- Create index on email and code for quick lookups
create index if not exists gemini_pro_activations_email_idx
  on public.gemini_pro_activations(email);

create index if not exists gemini_pro_activations_code_idx
  on public.gemini_pro_activations(code);
