create table if not exists public.smm_services (
  id text primary key,
  name text not null,
  type text not null default '',
  category text not null default 'Autres',
  provider_rate numeric(14, 6) not null default 0,
  sell_rate_xof integer not null default 0,
  min_quantity integer not null default 1,
  max_quantity integer not null default 1,
  refill boolean not null default false,
  cancel boolean not null default false,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint smm_services_rate_nonnegative check (provider_rate >= 0 and sell_rate_xof >= 0),
  constraint smm_services_quantity_range check (min_quantity > 0 and max_quantity >= min_quantity)
);

create table if not exists public.smm_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_xof bigint not null default 0 check (balance_xof >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.smm_wallet_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reference text not null unique,
  amount_xof bigint not null check (amount_xof > 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  payment_session_id text unique,
  payment_transaction_id text unique,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table if not exists public.smm_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service_id text not null references public.smm_services(id),
  service_name text not null,
  link text not null,
  quantity integer not null check (quantity > 0),
  charge_xof bigint not null check (charge_xof > 0),
  status text not null default 'submitting'
    check (status in ('submitting', 'pending', 'processing', 'completed', 'partial', 'canceled', 'failed', 'submission_check')),
  provider_order_id text unique,
  remains integer,
  start_count integer,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.smm_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('topup', 'order', 'refund')),
  amount_xof bigint not null check (amount_xof <> 0),
  reference text not null,
  created_at timestamptz not null default now(),
  unique (user_id, type, reference)
);

create index if not exists smm_services_category_idx on public.smm_services(category, name);
create index if not exists smm_orders_user_created_idx on public.smm_orders(user_id, created_at desc);
create index if not exists smm_wallet_transactions_user_created_idx on public.smm_wallet_transactions(user_id, created_at desc);

alter table public.smm_services enable row level security;
alter table public.smm_wallets enable row level security;
alter table public.smm_wallet_topups enable row level security;
alter table public.smm_orders enable row level security;
alter table public.smm_wallet_transactions enable row level security;

drop policy if exists "Authenticated users can view active SMM services" on public.smm_services;
create policy "Authenticated users can view active SMM services"
  on public.smm_services for select to authenticated using (active);

drop policy if exists "Users can view their SMM wallet" on public.smm_wallets;
create policy "Users can view their SMM wallet"
  on public.smm_wallets for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can view their SMM top-ups" on public.smm_wallet_topups;
create policy "Users can view their SMM top-ups"
  on public.smm_wallet_topups for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can view their SMM orders" on public.smm_orders;
create policy "Users can view their SMM orders"
  on public.smm_orders for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can view their SMM wallet transactions" on public.smm_wallet_transactions;
create policy "Users can view their SMM wallet transactions"
  on public.smm_wallet_transactions for select to authenticated using (auth.uid() = user_id);

revoke all on public.smm_services, public.smm_wallets, public.smm_wallet_topups,
  public.smm_orders, public.smm_wallet_transactions from anon, authenticated;
grant select on public.smm_services, public.smm_wallets, public.smm_wallet_topups,
  public.smm_orders, public.smm_wallet_transactions to authenticated;

create or replace function public.smm_reserve_order(
  p_user_id uuid,
  p_service_id text,
  p_link text,
  p_quantity integer
)
returns public.smm_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_service public.smm_services%rowtype;
  selected_wallet public.smm_wallets%rowtype;
  total_xof bigint;
  created_order public.smm_orders%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  select * into selected_service
  from public.smm_services
  where id = p_service_id and active = true;
  if not found then raise exception 'SERVICE_UNAVAILABLE'; end if;
  if p_quantity < selected_service.min_quantity or p_quantity > selected_service.max_quantity then
    raise exception 'INVALID_QUANTITY';
  end if;
  if selected_service.sell_rate_xof <= 0 then raise exception 'SERVICE_UNAVAILABLE'; end if;

  total_xof := ceil((selected_service.sell_rate_xof::numeric * p_quantity) / 1000)::bigint;
  insert into public.smm_wallets (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select * into selected_wallet from public.smm_wallets where user_id = p_user_id for update;
  if selected_wallet.balance_xof < total_xof then raise exception 'INSUFFICIENT_BALANCE'; end if;

  update public.smm_wallets
  set balance_xof = balance_xof - total_xof, updated_at = now()
  where user_id = p_user_id;

  insert into public.smm_orders (user_id, service_id, service_name, link, quantity, charge_xof)
  values (p_user_id, p_service_id, selected_service.name, p_link, p_quantity, total_xof)
  returning * into created_order;

  insert into public.smm_wallet_transactions (user_id, type, amount_xof, reference)
  values (p_user_id, 'order', -total_xof, created_order.id::text);
  return created_order;
end;
$$;

create or replace function public.smm_refund_order(p_order_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  failed_order public.smm_orders%rowtype;
begin
  select * into failed_order from public.smm_orders where id = p_order_id for update;
  if not found or failed_order.status not in ('submitting', 'failed') then return false; end if;

  insert into public.smm_wallet_transactions (user_id, type, amount_xof, reference)
  values (failed_order.user_id, 'refund', failed_order.charge_xof, failed_order.id::text)
  on conflict (user_id, type, reference) do nothing;
  if found then
    insert into public.smm_wallets (user_id, balance_xof) values (failed_order.user_id, failed_order.charge_xof)
    on conflict (user_id) do update
      set balance_xof = public.smm_wallets.balance_xof + excluded.balance_xof, updated_at = now();
  end if;
  update public.smm_orders
  set status = 'failed', error_message = left(p_reason, 300), updated_at = now()
  where id = p_order_id;
  return true;
end;
$$;

create or replace function public.smm_finish_order(
  p_order_id uuid,
  p_status text,
  p_provider_order_id text default null,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('pending', 'processing', 'completed', 'partial', 'canceled', 'submission_check') then
    raise exception 'INVALID_ORDER_STATUS';
  end if;
  update public.smm_orders
  set status = p_status,
      provider_order_id = coalesce(p_provider_order_id, provider_order_id),
      error_message = left(p_error, 300),
      updated_at = now()
  where id = p_order_id and status in ('submitting', 'submission_check', 'pending', 'processing');
  return found;
end;
$$;

create or replace function public.smm_credit_topup(
  p_topup_id uuid,
  p_transaction_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_topup public.smm_wallet_topups%rowtype;
begin
  select * into selected_topup from public.smm_wallet_topups where id = p_topup_id for update;
  if not found then raise exception 'TOPUP_NOT_FOUND'; end if;
  if selected_topup.status = 'confirmed' then
    return selected_topup.payment_transaction_id = p_transaction_id;
  end if;
  if selected_topup.status <> 'pending' then raise exception 'TOPUP_NOT_PENDING'; end if;

  insert into public.smm_wallet_transactions (user_id, type, amount_xof, reference)
  values (selected_topup.user_id, 'topup', selected_topup.amount_xof, selected_topup.id::text);
  insert into public.smm_wallets (user_id, balance_xof)
  values (selected_topup.user_id, selected_topup.amount_xof)
  on conflict (user_id) do update
    set balance_xof = public.smm_wallets.balance_xof + excluded.balance_xof, updated_at = now();

  update public.smm_wallet_topups
  set status = 'confirmed', payment_transaction_id = p_transaction_id, confirmed_at = now()
  where id = p_topup_id;
  return true;
end;
$$;

revoke all on function public.smm_reserve_order(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.smm_refund_order(uuid, text) from public, anon, authenticated;
revoke all on function public.smm_finish_order(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.smm_credit_topup(uuid, text) from public, anon, authenticated;
grant execute on function public.smm_reserve_order(uuid, text, text, integer) to service_role;
grant execute on function public.smm_refund_order(uuid, text) to service_role;
grant execute on function public.smm_finish_order(uuid, text, text, text) to service_role;
grant execute on function public.smm_credit_topup(uuid, text) to service_role;
