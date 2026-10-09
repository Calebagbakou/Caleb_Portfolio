alter table public.products
  add column if not exists logo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media',
  'site-media',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "site media: lecture publique" on storage.objects;
create policy "site media: lecture publique"
  on storage.objects for select
  using (bucket_id = 'site-media');

drop policy if exists "site media: téléversement admin" on storage.objects;
create policy "site media: téléversement admin"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'site-media' and public.is_admin());

drop policy if exists "site media: modification admin" on storage.objects;
create policy "site media: modification admin"
  on storage.objects for update to authenticated
  using (bucket_id = 'site-media' and public.is_admin())
  with check (bucket_id = 'site-media' and public.is_admin());

drop policy if exists "site media: suppression admin" on storage.objects;
create policy "site media: suppression admin"
  on storage.objects for delete to authenticated
  using (bucket_id = 'site-media' and public.is_admin());
