create table if not exists public.smm_learning_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  module_slug text not null check (module_slug in (
    'comprendre-le-smm',
    'choisir-ses-plateformes',
    'definir-sa-cible',
    'construire-sa-strategie',
    'creer-du-contenu',
    'organiser-son-calendrier',
    'publier-correctement',
    'comprendre-les-statistiques',
    'animer-sa-communaute',
    'trouver-ses-premiers-clients'
  )),
  completed_at timestamptz not null default now(),
  primary key (user_id, module_slug)
);

alter table public.smm_learning_progress enable row level security;

drop policy if exists "Users can view their SMM learning progress" on public.smm_learning_progress;
create policy "Users can view their SMM learning progress"
  on public.smm_learning_progress for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can add their SMM learning progress" on public.smm_learning_progress;
create policy "Users can add their SMM learning progress"
  on public.smm_learning_progress for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their SMM learning progress" on public.smm_learning_progress;
create policy "Users can update their SMM learning progress"
  on public.smm_learning_progress for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.smm_learning_progress from anon, authenticated;
grant select, insert, update on public.smm_learning_progress to authenticated;
