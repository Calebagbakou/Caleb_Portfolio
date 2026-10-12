alter table public.products
  add column if not exists regular_price numeric,
  add column if not exists promo_price numeric;

alter table public.products
  drop constraint if exists products_regular_promo_price_check,
  add constraint products_regular_promo_price_check
    check (
      (regular_price is null and promo_price is null)
      or (
        regular_price > 0
        and promo_price > 0
        and promo_price < regular_price
      )
    );
