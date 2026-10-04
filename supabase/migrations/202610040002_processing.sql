-- Persistent operation states and short-lived results allow lost responses to be recovered.
alter table public.service_requests add column fingerprint text;
alter table public.service_requests add column retryable boolean not null default false;
create table public.service_results (
 id uuid primary key references public.service_requests(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 result jsonb not null,
 expires_at timestamptz not null default now()+interval '24 hours'
);
alter table public.service_results enable row level security;
revoke all on public.service_results from anon,authenticated;
grant all on public.service_results to service_role;
create index on public.service_results(expires_at);

create function public.reserve_service_operation(p_user_id uuid,p_id uuid,p_feature text,p_requests integer,p_tokens_limit integer,p_audio_limit integer,p_tokens integer,p_audio integer,p_fingerprint text)
returns text language plpgsql security definer set search_path='' as $$
declare result text;
begin
 if p_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'Invalid fingerprint'; end if;
 result := public.reserve_service_request(p_user_id,p_id,p_feature,p_requests,p_tokens_limit,p_audio_limit,p_tokens,p_audio);
 if result='ok' then update public.service_requests set fingerprint=p_fingerprint where id=p_id and user_id=p_user_id; end if;
 return result;
end; $$;
create function public.finish_service_operation(p_user_id uuid,p_id uuid,p_success boolean,p_input integer,p_output integer,p_total integer,p_status integer,p_result jsonb,p_retryable boolean)
returns void language plpgsql security definer set search_path='' as $$
declare r public.service_requests;
begin
 select * into r from public.service_requests where id=p_id and user_id=p_user_id for update;
 if not found or r.status<>'pending' then return; end if;
 if p_success and (p_result is null or octet_length(p_result::text)>4000000) then raise exception 'Invalid result'; end if;
 perform public.finish_service_request(p_user_id,p_id,p_success,p_input,p_output,p_total,p_status);
 update public.service_requests set retryable=not p_success and p_retryable where id=p_id;
 if p_success then insert into public.service_results(id,user_id,result) values(p_id,p_user_id,p_result); end if;
 delete from public.service_results where expires_at<=now();
end; $$;
create function public.cleanup_service_results() returns void language sql security definer set search_path='' as $$
 delete from public.service_results where expires_at<=now();
$$;
revoke all on function public.reserve_service_operation(uuid,uuid,text,integer,integer,integer,integer,integer,text),public.finish_service_operation(uuid,uuid,boolean,integer,integer,integer,integer,jsonb,boolean),public.cleanup_service_results() from public,anon,authenticated;
grant execute on function public.reserve_service_operation(uuid,uuid,text,integer,integer,integer,integer,integer,text),public.finish_service_operation(uuid,uuid,boolean,integer,integer,integer,integer,jsonb,boolean),public.cleanup_service_results() to service_role;
