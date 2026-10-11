alter table public.products
  add column if not exists poster_ratio text not null default '4/3';

alter table public.products
  drop constraint if exists products_poster_ratio_check,
  add constraint products_poster_ratio_check
    check (poster_ratio in ('1/1', '4/3', '3/4', '16/9', '9/16'));
