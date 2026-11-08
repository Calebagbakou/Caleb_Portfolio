alter table public.smm_wallet_transactions
  drop constraint if exists smm_wallet_transactions_type_check;

alter table public.smm_wallet_transactions
  add constraint smm_wallet_transactions_type_check
  check (type in ('topup', 'order', 'refund', 'admin_credit', 'referral'));

alter table public.smm_wallet_transactions
  add column if not exists description text,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create table if not exists public.smm_referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  constraint smm_referral_codes_format check (code ~ '^[A-F0-9]{10}$')
);

create table if not exists public.smm_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  referral_code text not null references public.smm_referral_codes(code),
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  constraint smm_referrals_no_self_referral check (referrer_user_id <> referred_user_id)
);

create index if not exists smm_referrals_referrer_created_idx
  on public.smm_referrals(referrer_user_id, created_at desc);

alter table public.smm_referral_codes enable row level security;
alter table public.smm_referrals enable row level security;

revoke all on public.smm_referral_codes, public.smm_referrals from public, anon, authenticated;

create or replace function public.smm_get_referral_summary(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  referral_code text;
  referral_count bigint;
  rewarded_count bigint;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  for attempt in 1..5 loop
    referral_code := null;
    insert into public.smm_referral_codes (user_id, code)
    values (p_user_id, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)))
    on conflict do nothing;

    select code into referral_code
    from public.smm_referral_codes
    where user_id = p_user_id;

    exit when referral_code is not null;
  end loop;

  if referral_code is null then
    raise exception 'REFERRAL_CODE_GENERATION_FAILED';
  end if;

  select count(*), count(*) filter (where rewarded_at is not null)
  into referral_count, rewarded_count
  from public.smm_referrals
  where referrer_user_id = p_user_id;

  return jsonb_build_object(
    'code', referral_code,
    'referrals', referral_count,
    'rewardedReferrals', rewarded_count,
    'earnedXof', rewarded_count * 50,
    'pendingReferrals', referral_count - rewarded_count
  );
end;
$$;

create or replace function public.smm_claim_referral(p_user_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_code public.smm_referral_codes%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_user_id is null or p_code is null or p_code !~* '^[A-F0-9]{10}$' then
    return false;
  end if;

  insert into public.smm_wallets (user_id) values (p_user_id)
  on conflict (user_id) do nothing;
  perform 1 from public.smm_wallets where user_id = p_user_id for update;

  if exists (
    select 1
    from public.smm_wallet_topups
    where user_id = p_user_id and status = 'confirmed'
  ) then
    return false;
  end if;

  select * into selected_code
  from public.smm_referral_codes
  where code = upper(p_code);
  if not found or selected_code.user_id = p_user_id then
    return false;
  end if;

  insert into public.smm_referrals (referrer_user_id, referred_user_id, referral_code)
  values (selected_code.user_id, p_user_id, selected_code.code)
  on conflict (referred_user_id) do nothing;
  return found;
end;
$$;

create or replace function public.smm_admin_search_wallet_users(p_query text, p_limit integer default 20)
returns table(user_id uuid, email text, display_name text, balance_xof bigint)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  query_text text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  query_text := replace(
    replace(
      replace(btrim(coalesce(p_query, '')), chr(92), chr(92) || chr(92)),
      '%',
      chr(92) || '%'
    ),
    '_',
    chr(92) || '_'
  );
  if length(query_text) < 2 then
    return;
  end if;

  return query
  select
    users.id,
    users.email::text,
    coalesce(users.raw_user_meta_data ->> 'full_name', users.raw_user_meta_data ->> 'name', '')::text,
    coalesce(wallets.balance_xof, 0)::bigint
  from auth.users as users
  left join public.smm_wallets as wallets on wallets.user_id = users.id
  where users.email is not null
    and (
      users.email ilike '%' || query_text || '%' escape chr(92)
      or users.raw_user_meta_data ->> 'full_name' ilike '%' || query_text || '%' escape chr(92)
      or users.raw_user_meta_data ->> 'name' ilike '%' || query_text || '%' escape chr(92)
    )
  order by users.email
  limit greatest(1, least(coalesce(p_limit, 20), 50));
end;
$$;

create or replace function public.smm_admin_referral_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  referral_count bigint;
  rewarded_count bigint;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  select count(*), count(*) filter (where rewarded_at is not null)
  into referral_count, rewarded_count
  from public.smm_referrals;

  return jsonb_build_object(
    'referrals', referral_count,
    'rewardedReferrals', rewarded_count,
    'earnedXof', rewarded_count * 50,
    'pendingReferrals', referral_count - rewarded_count
  );
end;
$$;

create or replace function public.smm_admin_credit_wallet(
  p_user_id uuid,
  p_admin_id uuid,
  p_amount_xof bigint,
  p_reference text,
  p_description text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_balance bigint;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_user_id is null or p_admin_id is null or p_amount_xof is null
    or p_amount_xof < 1 or p_amount_xof > 1000000000
    or nullif(btrim(p_reference), '') is null
    or nullif(btrim(p_description), '') is null then
    raise exception 'INVALID_ADMIN_CREDIT';
  end if;

  insert into public.smm_wallet_transactions
    (user_id, type, amount_xof, reference, description, created_by)
  values
    (p_user_id, 'admin_credit', p_amount_xof, p_reference, left(btrim(p_description), 200), p_admin_id)
  on conflict (user_id, type, reference) do nothing;

  if not found then
    select balance_xof into updated_balance
    from public.smm_wallets
    where user_id = p_user_id;
    return coalesce(updated_balance, 0);
  end if;

  insert into public.smm_wallets (user_id, balance_xof)
  values (p_user_id, p_amount_xof)
  on conflict (user_id) do update
    set balance_xof = public.smm_wallets.balance_xof + excluded.balance_xof,
        updated_at = now()
  returning balance_xof into updated_balance;
  return updated_balance;
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
  selected_referral public.smm_referrals%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  select * into selected_topup
  from public.smm_wallet_topups
  where id = p_topup_id
  for update;
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

  select * into selected_referral
  from public.smm_referrals
  where referred_user_id = selected_topup.user_id and rewarded_at is null
  for update;

  if found then
    insert into public.smm_wallet_transactions (user_id, type, amount_xof, reference, description)
    values (
      selected_referral.referrer_user_id,
      'referral',
      50,
      selected_referral.id::text,
      'Récompense après le premier dépôt confirmé d’un filleul'
    )
    on conflict (user_id, type, reference) do nothing;

    if found then
      insert into public.smm_wallets (user_id, balance_xof)
      values (selected_referral.referrer_user_id, 50)
      on conflict (user_id) do update
        set balance_xof = public.smm_wallets.balance_xof + excluded.balance_xof,
            updated_at = now();
      update public.smm_referrals set rewarded_at = now() where id = selected_referral.id;
    end if;
  end if;

  return true;
end;
$$;

revoke all on function public.smm_get_referral_summary(uuid) from public, anon, authenticated;
revoke all on function public.smm_claim_referral(uuid, text) from public, anon, authenticated;
revoke all on function public.smm_admin_search_wallet_users(text, integer) from public, anon, authenticated;
revoke all on function public.smm_admin_referral_summary() from public, anon, authenticated;
revoke all on function public.smm_admin_credit_wallet(uuid, uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function public.smm_credit_topup(uuid, text) from public, anon, authenticated;

grant execute on function public.smm_get_referral_summary(uuid) to service_role;
grant execute on function public.smm_claim_referral(uuid, text) to service_role;
grant execute on function public.smm_admin_search_wallet_users(text, integer) to service_role;
grant execute on function public.smm_admin_referral_summary() to service_role;
grant execute on function public.smm_admin_credit_wallet(uuid, uuid, bigint, text, text) to service_role;
grant execute on function public.smm_credit_topup(uuid, text) to service_role;
