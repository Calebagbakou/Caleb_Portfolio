alter table public.projects
  drop constraint if exists projects_image_ratio_check;

alter table public.projects
  add constraint projects_image_ratio_check
  check (image_ratio in ('1/1', '4/3', '3/4', '16/9', '9/16'));
