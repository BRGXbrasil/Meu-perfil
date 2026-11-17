begin;
create schema if not exists elab_profile_private;
revoke all on schema elab_profile_private from public, anon, authenticated;
grant usage on schema elab_profile_private to service_role;

create table public.elab_client_profiles (
 id uuid primary key,
 submission jsonb not null check (jsonb_typeof(submission)='object' and octet_length(submission::text)<=20000),
 created_at timestamptz not null default now(),
 constraint profile_id_matches check (submission->>'id'=id::text),
 constraint profile_storage_consent check (submission->'consentPrivacy'='true'::jsonb and submission ? 'consentPrivacy'),
 constraint profile_answers_object check (jsonb_typeof(submission->'answers')='object' and submission ? 'answers')
);
create index elab_client_profiles_created on public.elab_client_profiles(created_at desc,id desc);
alter table public.elab_client_profiles enable row level security;
revoke all on public.elab_client_profiles from public, anon, authenticated;
grant select on public.elab_client_profiles to authenticated;
grant all on public.elab_client_profiles to service_role;
create policy profile_authorized_team_read on public.elab_client_profiles for select to authenticated
 using (exists (select 1 from public.elab_ops_members m where m.user_id=(select auth.uid()) and m.active and m.role in ('owner','director','admin','manager','reception')));

create table elab_profile_private.submit_limits (
 rate_key text not null check(length(rate_key)=64),
 hour_start timestamptz not null,
 attempts integer not null check(attempts>0),
 primary key(rate_key,hour_start)
);
create index profile_submit_limits_expiry on elab_profile_private.submit_limits(hour_start);
alter table elab_profile_private.submit_limits enable row level security;
revoke all on elab_profile_private.submit_limits from public, anon, authenticated;
grant all on elab_profile_private.submit_limits to service_role;

-- SECURITY INVOKER: only service_role can execute and access the write tables.
create function public.elab_profile_submit(p_submission jsonb,p_rate_key text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 v_id uuid;
 v_attempts integer;
 v_existing jsonb;
begin
 if p_rate_key !~ '^[0-9a-f]{64}$' or p_submission is null or p_submission->'consentPrivacy' is distinct from 'true'::jsonb then
  raise exception using errcode='22023',message='Invalid submission';
 end if;
 v_id := (p_submission->>'id')::uuid;
 -- Serialize retries for this random submission ID and compare canonical JSON.
 perform pg_advisory_xact_lock(hashtextextended(v_id::text,0));
 select submission into v_existing from public.elab_client_profiles where id=v_id;
 if found then
  if v_existing=p_submission then return jsonb_build_object('saved',true); end if;
  raise exception using errcode='22023',message='Submission already exists';
 end if;
 delete from elab_profile_private.submit_limits where hour_start < now()-interval '2 days';
 insert into elab_profile_private.submit_limits(rate_key,hour_start,attempts)
 values(p_rate_key,date_trunc('hour',now()),1)
 on conflict(rate_key,hour_start) do update set attempts=elab_profile_private.submit_limits.attempts+1
 returning attempts into v_attempts;
 if v_attempts>30 then raise exception using errcode='P0429',message='Rate limit'; end if;
 insert into public.elab_client_profiles(id,submission) values(v_id,p_submission);
 return jsonb_build_object('saved',true);
end;
$$;
revoke all on function public.elab_profile_submit(jsonb,text) from public,anon,authenticated;
grant execute on function public.elab_profile_submit(jsonb,text) to service_role;
commit;
