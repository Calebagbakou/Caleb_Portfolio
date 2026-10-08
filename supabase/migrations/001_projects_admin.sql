-- Adapt the existing projects/categories/media model without replacing it.
-- Existing project IDs, relations, statuses, media rows, and RLS policies are retained.
alter table public.projects add column if not exists category text not null default 'Autres';
alter table public.projects add column if not exists media_type text not null default 'image';
alter table public.projects add column if not exists media_url text;
alter table public.projects add column if not exists thumbnail_url text;
alter table public.projects add column if not exists published boolean not null default false;
alter table public.projects add column if not exists legacy_key text;

create unique index if not exists projects_legacy_key_unique
  on public.projects (legacy_key)
  where legacy_key is not null;

-- Keep the editor's simple category field in sync with the existing category relation.
update public.projects as project
set category = category_row.label
from public.categories as category_row
where project.category_id = category_row.id
  and (project.category is null or project.category = '' or project.category = 'Autres');

-- Preserve the existing publication contract used by the current public RLS policy.
update public.projects
set published = (status = 'published')
where published is distinct from (status = 'published');

-- Re-executing this migration is safe: subsequent edits keep these two values in sync.
create or replace function public.sync_project_publication()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.published is distinct from (new.status = 'published') then
      new.status := case when new.published then 'published' else 'draft' end;
    end if;
  elsif new.published is distinct from old.published then
    new.status := case when new.published then 'published' else 'draft' end;
  elsif new.status is distinct from old.status then
    new.published := (new.status = 'published');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists projects_sync_publication on public.projects;
create trigger projects_sync_publication
  before insert or update on public.projects
  for each row execute function public.sync_project_publication();

-- Resolve legacy media relations when the old media row already has an external URL.
update public.projects as project
set media_url = video_media.external_url,
    media_type = case
      when video_media.type = 'youtube'
        or video_media.external_url ~* '^https?://(www\.)?(youtube\.com|youtu\.be)/'
        then 'youtube'
      else 'external_video'
    end
from public.media as video_media
where project.video_media_id = video_media.id
  and project.media_type = 'image';

update public.projects as project
set media_url = cover_media.external_url
from public.media as cover_media
where project.cover_media_id = cover_media.id
  and project.media_url is null
  and cover_media.external_url is not null;

update public.projects as project
set thumbnail_url = coalesce(cover_media.thumbnail_url, cover_media.external_url)
from public.media as cover_media
where project.cover_media_id = cover_media.id
  and project.thumbnail_url is null
  and (cover_media.thumbnail_url is not null or cover_media.external_url is not null);

-- Preserve the 16 React portfolio cards as editable, published project rows.
-- Existing rows with the same title are left untouched; legacy_key prevents re-import.
with legacy_projects
  (legacy_key, slug, title, description, category, media_type, media_url, thumbnail_url, published, status) as (
  values
  ('legacy:images:campagne-aurora', 'campagne-aurora', 'Campagne Aurora', '', 'images', 'image', null, null, true, 'published'),
  ('legacy:images:portraits-studio', 'portraits-studio', 'Portraits studio', '', 'images', 'image', null, null, true, 'published'),
  ('legacy:images:visuels-produit', 'visuels-produit', 'Visuels produit', '', 'images', 'image', null, null, true, 'published'),
  ('legacy:videos:teaser-produit', 'teaser-produit', 'Teaser produit', '', 'videos', 'external_video', 'https://player.vimeo.com/video/1223912721?h=7443aab3a0&title=0&byline=0&portrait=0', null, true, 'published'),
  ('legacy:videos:clip-reseaux-sociaux', 'clip-reseaux-sociaux', 'Clip réseaux sociaux', '', 'videos', 'image', null, null, true, 'published'),
  ('legacy:videos:video-evenementielle', 'video-evenementielle', 'Vidéo évènementielle', '', 'videos', 'image', null, null, true, 'published'),
  ('legacy:motion:motion-intro', 'motion-intro', 'Motion intro', '', 'motion', 'image', null, null, true, 'published'),
  ('legacy:motion:habillage-logo-anime', 'habillage-logo-anime', 'Habillage logo animé', '', 'motion', 'image', null, null, true, 'published'),
  ('legacy:pub:pub-reseaux-sociaux', 'pub-reseaux-sociaux', 'Pub réseaux sociaux', '', 'pub', 'image', null, null, true, 'published'),
  ('legacy:pub:campagne-display', 'campagne-display', 'Campagne display', '', 'pub', 'image', null, null, true, 'published'),
  ('legacy:logos:logo-nova-studio', 'logo-nova-studio', 'Logo Nova Studio', '', 'logos', 'image', null, null, true, 'published'),
  ('legacy:logos:identite-atlas', 'identite-atlas', 'Identité Atlas', '', 'logos', 'image', null, null, true, 'published'),
  ('legacy:affiches:affiche-evenement', 'affiche-evenement', 'Affiche événement', '', 'affiches', 'image', null, null, true, 'published'),
  ('legacy:affiches:affiche-concert', 'affiche-concert', 'Affiche concert', '', 'affiches', 'image', null, null, true, 'published'),
  ('legacy:retouches:retouche-portrait', 'retouche-portrait', 'Retouche portrait', '', 'retouches', 'image', null, null, true, 'published'),
  ('legacy:retouches:retouche-produit', 'retouche-produit', 'Retouche produit', '', 'retouches', 'image', null, null, true, 'published')
)
insert into public.projects
  (legacy_key, slug, title, description, category, media_type, media_url, thumbnail_url, published, status)
select legacy.legacy_key, legacy.slug, legacy.title, legacy.description, legacy.category,
  legacy.media_type, legacy.media_url, legacy.thumbnail_url, legacy.published, legacy.status
from legacy_projects as legacy
where not exists (
  select 1 from public.projects as current_project
  where current_project.legacy_key = legacy.legacy_key
     or lower(btrim(current_project.title)) = lower(btrim(legacy.title))
)
on conflict (legacy_key) where legacy_key is not null do nothing;
