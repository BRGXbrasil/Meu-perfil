begin;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000101'),('00000000-0000-4000-8000-000000000102'),('00000000-0000-4000-8000-000000000103');
insert into public.elab_ops_members(user_id,role,active) values
('00000000-0000-4000-8000-000000000101','manager',true),
('00000000-0000-4000-8000-000000000102','cleaning',true),
('00000000-0000-4000-8000-000000000103','reception',false);
set local role service_role;
do $$
declare
 payload jsonb := '{"id":"00000000-0000-4000-8000-000000000201","answers":{"name":"Teste fictício"},"consentPrivacy":true,"consentContact":false,"consentMarketing":false,"consentImage":false,"privacyVersion":"2026-11-16"}';
 result jsonb;
 i integer;
begin
 result:=public.elab_profile_submit(payload,repeat('a',64));
 if result->>'saved'<>'true' then raise exception 'save not confirmed';end if;
 perform public.elab_profile_submit(payload,repeat('a',64));
 if (select count(*) from public.elab_client_profiles where id=(payload->>'id')::uuid)<>1 then raise exception 'duplicate';end if;
 begin
  perform public.elab_profile_submit(payload||'{"consentContact":true}',repeat('a',64));
  raise exception 'changed retry accepted';
 exception when sqlstate '22023' then null;end;
 for i in 1..29 loop
  payload:=jsonb_set(payload,'{id}',to_jsonb(('00000000-0000-4000-8000-'||lpad((300+i)::text,12,'0'))));
  perform public.elab_profile_submit(payload,repeat('a',64));
 end loop;
 begin
  payload:=jsonb_set(payload,'{id}','"00000000-0000-4000-8000-000000000999"');
  perform public.elab_profile_submit(payload,repeat('a',64));
  raise exception 'rate limit missing';
 exception when sqlstate 'P0429' then null;end;
end $$;
set local role anon;
do $$ begin
 begin
  perform count(*) from public.elab_client_profiles;
  raise exception 'anonymous read allowed';
 exception when insufficient_privilege then null;end;
 begin
  perform public.elab_profile_submit('{}',repeat('a',64));
  raise exception 'anonymous RPC allowed';
 exception when insufficient_privilege then null;end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
do $$ begin
 if (select count(*) from public.elab_client_profiles where id='00000000-0000-4000-8000-000000000201')<>1 then raise exception 'authorized read denied';end if;
 begin
  delete from public.elab_client_profiles where id='00000000-0000-4000-8000-000000000201';
  raise exception 'client delete allowed';
 exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
do $$ begin
 if exists(select 1 from public.elab_client_profiles) then raise exception 'unauthorized read allowed';end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',true);
do $$ begin
 if exists(select 1 from public.elab_client_profiles) then raise exception 'inactive read allowed';end if;
end $$;
rollback;
select 'save, retry, conflict, rate limit, anonymous denial, role and inactive access: passed; fixtures rolled back' as verification;
