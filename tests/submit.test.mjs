import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../supabase/functions/elab-profile-submit/core.mjs';
const valid=()=>({id:crypto.randomUUID(),answers:{name:'Cliente fictícia',care:'Texto informado voluntariamente'},consentContact:false,consentMarketing:false,consentImage:false,consentPrivacy:true,privacyVersion:'2026-11-16'});
const request=(body,key='public-test')=>new Request('https://test/submit',{method:'POST',headers:{apikey:key,'content-type':'application/json',origin:'https://brgxbrasil.github.io'},body:JSON.stringify(body)});
test('rejects unauthorized key before touching storage',async()=>{
 const handler=createHandler({publicKey:'public-test',save:()=>assert.fail('storage touched')});
 assert.equal((await handler(request(valid(),'wrong'))).status,401);
});
test('rejects invalid consent, UUID, unknown answers and oversized strings',async()=>{
 const handler=createHandler({publicKey:'public-test',save:()=>assert.fail('storage touched')});
 for(const payload of [{...valid(),consentPrivacy:false},{...valid(),id:'fake'},{...valid(),answers:{unknown:'field'}},{...valid(),answers:{name:'x'.repeat(801)}},{...valid(),consentContact:'yes'}])assert.equal((await handler(request(payload))).status,400);
});
test('returns success only after storage confirmation, preserves consent refusals',async()=>{
 const payload=valid();let received;
 const handler=createHandler({publicKey:'public-test',save:async body=>{received=body;return {saved:true}}});
 const res=await handler(request(payload));assert.equal(res.status,201);assert.deepEqual(await res.json(),{saved:true,id:payload.id});assert.equal(received.consentContact,false);
});
test('returns failure if storage fails and rate limit status without response data',async()=>{
 for(const [error,status] of [[new Error('private details'),503],[Object.assign(new Error('rate'),{code:'P0429'}),429]]){
 const handler=createHandler({publicKey:'public-test',save:async()=>{throw error}});
 const res=await handler(request(valid()));assert.equal(res.status,status);assert.equal((await res.text()).includes('private details'),false);
 }
});
test('rejects excessive bodies and wrong origins',async()=>{
 const handler=createHandler({publicKey:'public-test',save:()=>assert.fail('storage touched')});
 assert.equal((await handler(request({...valid(),extra:'x'.repeat(50000)}))).status,413);
 const req=request(valid());req.headers.set('origin','https://evil.example');assert.equal((await handler(req)).status,403);
});
