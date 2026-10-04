-- Operator access is provisioned explicitly by the project owner, never by a client.
create table public.operator_accounts(user_id uuid primary key references auth.users(id) on delete cascade,created_at timestamptz not null default now());
alter table public.operator_accounts enable row level security;
revoke all on public.operator_accounts from anon,authenticated;
grant select on public.operator_accounts to authenticated;
grant all on public.operator_accounts to service_role;
create policy own_operator_membership on public.operator_accounts for select to authenticated using(user_id=auth.uid());
create table public.operational_alerts(key text primary key,severity text not null,active boolean not null,message text not null,observed_at timestamptz not null default now(),acknowledged_until timestamptz);
alter table public.operational_alerts enable row level security;
revoke all on public.operational_alerts from anon,authenticated;
grant all on public.operational_alerts to service_role;
create function public.backend_health() returns boolean language sql security definer set search_path='' as $$
 select to_regclass('public.billing_accounts') is not null and to_regclass('public.service_requests') is not null and to_regclass('public.service_results') is not null and to_regclass('public.operator_accounts') is not null;
$$;
create function public.refresh_operations_alerts() returns void language plpgsql security definer set search_path='' as $$
declare pending integer; failed integer; total integer;
begin
 select count(*) into pending from public.service_requests where status='pending' and created_at<now()-interval '5 minutes';
 select count(*) filter(where status='failed'),count(*) into failed,total from public.service_requests where created_at>now()-interval '1 hour';
 insert into public.operational_alerts(key,severity,active,message) values
 ('interrupted_operations','warning',pending>0,pending::text||' operaciones con resultado pendiente durante más de cinco minutos.'),
 ('provider_failures','critical',failed>=5 and failed::numeric/greatest(total,1)>=0.25,failed::text||' operaciones fallidas de '||total::text||' durante la última hora.')
 on conflict(key) do update set active=excluded.active,message=excluded.message,observed_at=now(),acknowledged_until=case when not public.operational_alerts.active and excluded.active then null else public.operational_alerts.acknowledged_until end;
end; $$;
create function public.operations_snapshot(p_operator uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare snapshot jsonb;
begin
 if not exists(select 1 from public.operator_accounts where user_id=p_operator) then raise exception 'Operator access required'; end if;
 perform public.refresh_operations_alerts();
 select jsonb_build_object('alerts',coalesce((select jsonb_agg(to_jsonb(a)) from public.operational_alerts a where a.active),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(to_jsonb(r)) from (select id,user_id,feature,status,provider_status,created_at,completed_at,retryable from public.service_requests order by created_at desc limit 50) r),'[]'::jsonb),
 'accounts',coalesce((select jsonb_agg(to_jsonb(u)) from (
 select c.user_id,c.tokens,c.audio_seconds,coalesce(b.used,0) as requests,
 coalesce((select case max(case when s.plan='plus' then 2 when s.plan='pro' then 1 else 0 end) when 2 then 'plus' when 1 then 'pro' else 'free' end from public.billing_subscriptions s where s.user_id=c.user_id and s.status in ('active','trialing') and s.current_period_end>now()),'free') as plan,
 coalesce((select sum(r.input_tokens) from public.service_requests r where r.user_id=c.user_id and r.month=c.month and r.input_tokens is not null),0) as measured_input,
 coalesce((select sum(greatest(r.total_tokens-coalesce(r.input_tokens,0),0)) from public.service_requests r where r.user_id=c.user_id and r.month=c.month and r.input_tokens is not null and r.total_tokens is not null),0) as measured_output,
 (select count(*) from public.service_requests r where r.user_id=c.user_id and r.month=c.month and r.feature<>'transcription' and (r.total_tokens is null or r.input_tokens is null)) as unmeasured
 from public.service_consumption c left join public.billing_usage b on b.user_id=c.user_id and b.month=c.month
 where c.month=date_trunc('month',now() at time zone 'UTC')::date order by c.tokens desc limit 100
 ) u),'[]'::jsonb)) into snapshot;
 return snapshot;
end; $$;
create function public.acknowledge_operational_alert(p_operator uuid,p_key text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.operator_accounts where user_id=p_operator) then raise exception 'Operator access required'; end if;
 update public.operational_alerts set acknowledged_until=now()+interval '30 minutes' where key=p_key and active;
end; $$;
revoke all on function public.backend_health(),public.refresh_operations_alerts(),public.operations_snapshot(uuid),public.acknowledge_operational_alert(uuid,text) from public,anon,authenticated;
grant execute on function public.backend_health(),public.refresh_operations_alerts(),public.operations_snapshot(uuid),public.acknowledge_operational_alert(uuid,text) to service_role;
