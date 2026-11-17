import {createClient} from 'npm:@supabase/supabase-js@2.76.1';
import {createHandler} from './core.mjs';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(Deno.env.get('SUPABASE_URL')!,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const publicKey=['sb_publishable_nviD65C5Y-mgrj04dwEheQ_x17AjVfL',Deno.env.get('SUPABASE_ANON_KEY')];
Deno.serve(createHandler({publicKey,save:async(body:unknown,req:Request)=>{
 // Only a keyed, daily hash of the proxy-reported address is kept, never the raw address.
 const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(serviceKey),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const hash=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(new Date().toISOString().slice(0,10)+':'+ip));
 const rateKey=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
 const {data,error}=await db.rpc('elab_profile_submit',{p_submission:body,p_rate_key:rateKey});
 if(error)throw error;
 return data;
}}));
