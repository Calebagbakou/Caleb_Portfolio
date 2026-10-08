-- Opt-in only: YouTube preview playback is disabled for existing/new projects by default.
alter table public.projects
  add column if not exists autoplay_preview boolean not null default false;
