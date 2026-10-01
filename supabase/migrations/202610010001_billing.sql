-- Billing is written exclusively by verified Edge Functions using service_role.
create table public.billing_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique
);
create table public.billing_subscriptions (
  id text primary key,
  user_id uuid not null references public.billing_accounts(user_id) on delete cascade,
  plan text check (plan in ('pro', 'plus')),
  price_id text,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);
create index on public.billing_subscriptions(user_id);
create table public.billing_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,
  used integer not null default 0 check (used >= 0),
  primary key (user_id, month)
);
create table public.billing_events (
  id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);
create table public.billing_locks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token uuid not null,
  expires_at timestamptz not null
);
alter table public.billing_accounts enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_usage enable row level security;
alter table public.billing_events enable row level security;
alter table public.billing_locks enable row level security;
revoke all on public.billing_accounts, public.billing_subscriptions, public.billing_usage, public.billing_events, public.billing_locks from anon, authenticated;
grant select on public.billing_accounts, public.billing_subscriptions, public.billing_usage to authenticated;
grant all on public.billing_accounts, public.billing_subscriptions, public.billing_usage, public.billing_events, public.billing_locks to service_role;
create policy own_billing_account on public.billing_accounts for select to authenticated using (user_id = auth.uid());
create policy own_subscriptions on public.billing_subscriptions for select to authenticated using (user_id = auth.uid());
create policy own_usage on public.billing_usage for select to authenticated using (user_id = auth.uid());

create function public.acquire_billing_lock(p_user_id uuid, p_token uuid) returns boolean
language sql security definer set search_path = '' as $$
  with acquired as (
    insert into public.billing_locks(user_id, token, expires_at)
    values (p_user_id, p_token, now() + interval '2 minutes')
    on conflict (user_id) do update set token = excluded.token, expires_at = excluded.expires_at
    where public.billing_locks.expires_at < now()
    returning user_id
  ) select exists(select 1 from acquired);
$$;
create function public.release_billing_lock(p_user_id uuid, p_token uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.billing_locks where user_id = p_user_id and token = p_token;
$$;
create function public.replace_billing_subscriptions(p_user_id uuid, p_token uuid, p_subscriptions jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.billing_locks where user_id = p_user_id and token = p_token and expires_at > now() for update;
  if not found then raise exception 'Billing lock expired'; end if;
  delete from public.billing_subscriptions where user_id = p_user_id;
  insert into public.billing_subscriptions(id, user_id, plan, price_id, status, current_period_end, cancel_at_period_end)
  select x.id, p_user_id, x.plan, x.price_id, x.status, x.current_period_end, x.cancel_at_period_end
  from jsonb_to_recordset(p_subscriptions) as x(id text, plan text, price_id text, status text, current_period_end timestamptz, cancel_at_period_end boolean);
end;
$$;
-- Atomic quota reservation. Calls reaching the provider count, including failed attempts.
create function public.reserve_ai_request(p_user_id uuid, p_limit integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if p_limit < 1 or p_limit > 500 then raise exception 'Invalid quota'; end if;
  insert into public.billing_usage(user_id, month, used)
  values (p_user_id, date_trunc('month', now() at time zone 'UTC')::date, 1)
  on conflict (user_id, month) do update set used = public.billing_usage.used + 1
  where public.billing_usage.used < p_limit returning used into n;
  return n;
end;
$$;
revoke all on function public.acquire_billing_lock(uuid, uuid), public.release_billing_lock(uuid, uuid), public.replace_billing_subscriptions(uuid, uuid, jsonb), public.reserve_ai_request(uuid, integer) from public, anon, authenticated;
grant execute on function public.acquire_billing_lock(uuid, uuid), public.release_billing_lock(uuid, uuid), public.replace_billing_subscriptions(uuid, uuid, jsonb), public.reserve_ai_request(uuid, integer) to service_role;
