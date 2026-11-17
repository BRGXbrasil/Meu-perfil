import {createClient} from 'npm:@supabase/supabase-js@2.76.1';
import {createReadHandler} from './core.mjs';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const publicKey={"key_ops":["verify"],"ext":true,"kty":"EC","x":"rzQpZKZ0LvqDjqgMRdR3KSfER_tzbDpq_ERspv-bc_c","y":"7-EHxgK_S-Vc0FCT1SP2Qf3b0rfAhIPY9YKWtzXBhlU","crv":"P-256"};
Deno.serve(createReadHandler({publicKey,read:async(page:number,search:string)=>{
 let query=db.from('elab_client_profiles').select('id,created_at,submission').order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*25,page*25+25);
 if(search)query=query.ilike('submission->answers->>name','%'+search.replace(/[\\%_]/g,'\\$&')+'%');
 const {data,error}=await query;if(error)throw error;return data||[];
}}));
