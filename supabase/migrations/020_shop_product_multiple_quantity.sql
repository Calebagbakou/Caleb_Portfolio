alter table public.products
  add column if not exists allow_multiple_qty boolean not null default false;

update public.products
set allow_multiple_qty = true
where slug = 'gemini-pro'
  and not allow_multiple_qty;

create or replace function public.validate_shop_order_item_quantity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allow_multiple_qty boolean;
begin
  if new.qty is null or new.qty < 1 or new.qty > 20 then
    raise exception 'La quantité doit être comprise entre 1 et 20.';
  end if;

  select product.allow_multiple_qty
  into v_allow_multiple_qty
  from public.products as product
  where product.id = new.product_id;

  if not found then
    raise exception 'Le produit de la commande est introuvable.';
  end if;
  if not v_allow_multiple_qty and new.qty > 1 then
    raise exception 'Ce produit ne peut être commandé qu’en un seul exemplaire.';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_shop_order_item_quantity() from public, anon, authenticated;

drop trigger if exists validate_shop_order_item_quantity on public.order_items;
create trigger validate_shop_order_item_quantity
before insert or update of product_id, qty on public.order_items
for each row execute function public.validate_shop_order_item_quantity();
