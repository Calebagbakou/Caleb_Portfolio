alter table public.gemini_pro_activations
  alter column email drop not null;

update public.product_plans as plan
set active = (plan.slug = '18mois')
from public.products as product
where plan.product_id = product.id
  and product.slug = 'gemini-pro';

update public.products
set
  description = 'Obtiens un lien d’activation Gemini AI Pro valable 18 mois, généré après confirmation du paiement.',
  tagline = 'Gemini AI Pro — activation 18 mois par lien.',
  highlights = array[
    'Lien d’activation généré après paiement confirmé',
    'Accès Gemini AI Pro pendant 18 mois',
    'Livraison automatique via PixVerify'
  ],
  updated_at = now()
where slug = 'gemini-pro';

create or replace function public.enforce_gemini_18_month_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.active and exists (
    select 1
    from public.products as product
    where product.id = new.product_id
      and product.slug = 'gemini-pro'
  ) and new.slug <> '18mois' then
    raise exception 'Seule la formule Gemini Pro 18 mois peut être activée.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_gemini_18_month_plan on public.product_plans;
create trigger enforce_gemini_18_month_plan
before insert or update of product_id, slug, active
on public.product_plans
for each row
execute function public.enforce_gemini_18_month_plan();
