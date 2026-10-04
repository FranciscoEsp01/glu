-- Credentials remain in Edge Function secrets. This ledger never stores meeting content.
create table public.service_consumption (
 user_id uuid not null references auth.users(id) on delete cascade,
 month date not null,
 tokens bigint not null default 0 check(tokens >= 0),
 audio_seconds integer not null default 0 check(audio_seconds >= 0),
 primary key(user_id, month)
);
create table public.service_requests (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 month date not null,
 feature text not null check(feature in ('summary','knowledge','transcription')),
 status text not null default 'pending' check(status in ('pending','succeeded','failed')),
 reserved_tokens integer not null,
 audio_seconds integer not null,
 input_tokens integer,
 output_tokens integer,
 total_tokens integer,
 measurement text not null default 'reserved' check(measurement in ('reserved','reported','pcm')),
 provider_status integer,
 created_at timestamptz not null default now(),
 completed_at timestamptz
);
create index on public.service_requests(user_id, created_at);
alter table public.service_consumption enable row level security;
alter table public.service_requests enable row level security;
revoke all on public.service_consumption, public.service_requests from anon, authenticated;
grant select on public.service_consumption, public.service_requests to authenticated;
grant all on public.service_consumption, public.service_requests to service_role;
create policy own_consumption on public.service_consumption for select to authenticated using(user_id=auth.uid());
create policy own_service_requests on public.service_requests for select to authenticated using(user_id=auth.uid());

create function public.reserve_service_request(p_user_id uuid,p_id uuid,p_feature text,p_requests integer,p_tokens_limit integer,p_audio_limit integer,p_tokens integer,p_audio integer)
returns text language plpgsql security definer set search_path='' as $$
declare m date := date_trunc('month',now() at time zone 'UTC')::date; c public.service_consumption; n integer;
begin
 if p_feature not in ('summary','knowledge','transcription') or p_requests < 1 or p_requests > 500 or p_tokens_limit < 1 or p_tokens_limit > 10000000 or p_audio_limit < 1 or p_audio_limit > 90000 or p_tokens < 0 or p_tokens > 300000 or p_audio < 0 or p_audio > 300 then raise exception 'Invalid reservation'; end if;
 if (p_feature='transcription' and (p_audio=0 or p_tokens<>0)) or (p_feature<>'transcription' and (p_tokens=0 or p_audio<>0)) then raise exception 'Invalid units'; end if;
 insert into public.service_consumption(user_id,month) values(p_user_id,m) on conflict do nothing;
 select * into c from public.service_consumption where user_id=p_user_id and month=m for update;
 if exists(select 1 from public.service_requests where id=p_id) then return 'duplicate'; end if;
 if (select count(*) from public.service_requests where user_id=p_user_id and created_at>now()-interval '1 minute') >= 10 then return 'rate'; end if;
 if (select count(*) from public.service_requests where user_id=p_user_id and status='pending' and created_at>now()-interval '5 minutes') >= 2 then return 'concurrency'; end if;
 if c.tokens+p_tokens>p_tokens_limit or c.audio_seconds+p_audio>p_audio_limit then return 'quota'; end if;
 if p_feature<>'transcription' then
  select public.reserve_ai_request(p_user_id,p_requests) into n;
  if n is null then return 'quota'; end if;
 end if;
 insert into public.service_requests(id,user_id,month,feature,reserved_tokens,audio_seconds,measurement) values(p_id,p_user_id,m,p_feature,p_tokens,p_audio,case when p_feature='transcription' then 'pcm' else 'reserved' end);
 update public.service_consumption set tokens=tokens+p_tokens,audio_seconds=audio_seconds+p_audio where user_id=p_user_id and month=m;
 return 'ok';
end;
$$;
create function public.finish_service_request(p_user_id uuid,p_id uuid,p_success boolean,p_input integer,p_output integer,p_total integer,p_status integer)
returns void language plpgsql security definer set search_path='' as $$
declare r public.service_requests; charged integer;
begin
 select * into r from public.service_requests where id=p_id and user_id=p_user_id for update;
 if not found or r.status<>'pending' then return; end if;
 -- Missing usage or interrupted calls keep the full reservation, never an invented zero.
 charged := case when p_total is not null and p_total>=0 then p_total else r.reserved_tokens end;
 update public.service_consumption set tokens=tokens+charged-r.reserved_tokens where user_id=p_user_id and month=r.month;
 update public.service_requests set status=case when p_success then 'succeeded' else 'failed' end,input_tokens=p_input,output_tokens=p_output,total_tokens=p_total,provider_status=p_status,measurement=case when p_total is not null then 'reported' else measurement end,completed_at=now() where id=p_id;
end;
$$;
revoke all on function public.reserve_service_request(uuid,uuid,text,integer,integer,integer,integer,integer),public.finish_service_request(uuid,uuid,boolean,integer,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_service_request(uuid,uuid,text,integer,integer,integer,integer,integer),public.finish_service_request(uuid,uuid,boolean,integer,integer,integer,integer) to service_role;
