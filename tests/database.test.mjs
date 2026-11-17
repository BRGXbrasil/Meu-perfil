import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('database enforces access, idempotency and rate limits',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create table public.elab_ops_members(user_id uuid references auth.users(id),role text,active boolean);grant select on public.elab_ops_members to authenticated;alter table public.elab_ops_members enable row level security;create policy self_read on public.elab_ops_members for select to authenticated using(user_id=auth.uid());`);
 await db.exec(await readFile('database/profile-storage.sql','utf8'));
 await db.exec(await readFile('tests/database-check.sql','utf8'));
 }finally{await db.close();}
});
