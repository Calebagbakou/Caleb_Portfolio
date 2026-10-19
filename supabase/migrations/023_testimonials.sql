create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  content text not null check (char_length(trim(content)) between 10 and 600),
  photo_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.testimonials enable row level security;

drop policy if exists "testimonials: lecture publique" on public.testimonials;
create policy "testimonials: lecture publique"
  on public.testimonials for select
  using (is_published = true or public.is_admin());

drop policy if exists "testimonials: envoi public" on public.testimonials;
create policy "testimonials: envoi public"
  on public.testimonials for insert
  with check (is_published = false);

drop policy if exists "testimonials: administration" on public.testimonials;
create policy "testimonials: administration"
  on public.testimonials for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
