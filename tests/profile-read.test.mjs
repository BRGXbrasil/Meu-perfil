import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReadHandler} from '../supabase/functions/elab-profile-read/core.mjs';
test('only signed recent requests can read profiles, with bounded pagination',async()=>{
 const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const publicKey=await crypto.subtle.exportKey('jwk',keys.publicKey);let calls=0;
 const handler=createReadHandler({publicKey,read:async(page,search)=>{calls++;assert.equal(page,2);assert.equal(search,'Ana');return []}});
 const request=async(ts=Date.now(),signed=true)=>{const payload=JSON.stringify({ts,page:2,search:'Ana',nonce:crypto.randomUUID()});const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,new TextEncoder().encode(payload));return new Request('https://test/read',{method:'POST',headers:{'content-type':'application/json','x-elab-signature':signed?Buffer.from(sig).toString('base64'):'invalid'},body:payload})};
 assert.equal((await handler(await request(Date.now(),false))).status,403);
 assert.equal((await handler(await request(Date.now()-60000))).status,403);
 assert.equal(calls,0);
 const response=await handler(await request());assert.equal(response.status,200);assert.deepEqual(await response.json(),{profiles:[]});assert.equal(calls,1);
});
