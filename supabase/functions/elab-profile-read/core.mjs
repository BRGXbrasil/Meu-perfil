export function createReadHandler({publicKey,read}){
 return async req=>{
  const reply=(status,data)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
  if(req.method!=='POST')return reply(405,{error:'Método não permitido.'});
  try{
   const text=await req.text();if(text.length>6000)return reply(413,{error:'Solicitação muito longa.'});
   const payload=JSON.parse(text);
   if(!Number.isSafeInteger(payload.ts)||Math.abs(Date.now()-payload.ts)>30000||!Number.isSafeInteger(payload.page)||payload.page<0||payload.page>10000||typeof payload.search!=='string'||payload.search.length>160||typeof payload.nonce!=='string'||payload.nonce.length!==36)return reply(403,{error:'Solicitação inválida.'});
   const signature=Uint8Array.from(atob(req.headers.get('x-elab-signature')||''),c=>c.charCodeAt(0));
   const key=await crypto.subtle.importKey('jwk',publicKey,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
   if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,signature,new TextEncoder().encode(text)))return reply(403,{error:'Acesso não autorizado.'});
   const profiles=await read(payload.page,payload.search);
   return reply(200,{profiles});
  }catch{return reply(503,{error:'Não foi possível consultar os perfis.'})}
 };
}
