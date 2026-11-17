const answerKeys=new Set(['name','whatsapp','birthday','discovery','ritual','service','goal','hair','routine','care','change','products','inspiration','car']);
const consentKeys=['consentContact','consentMarketing','consentImage','consentPrivacy'];
const allowedOrigins=new Set(['https://brgxbrasil.github.io','https://elab-unificado-ops.dazzlingbegonia2.chatgpt.site']);
export function createHandler({publicKey,save}){
 return async function handle(req){
  const origin=req.headers.get('origin');
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(allowedOrigins.has(origin)?{'Access-Control-Allow-Origin':origin}:{}),'Access-Control-Allow-Headers':'apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
  const respond=(status,data)=>new Response(JSON.stringify(data),{status,headers});
  if(origin&&!allowedOrigins.has(origin))return respond(403,{error:'Origem não permitida.'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return respond(405,{error:'Método não permitido.'});
  if(!(Array.isArray(publicKey)?publicKey:[publicKey]).filter(Boolean).includes(req.headers.get('apikey')))return respond(401,{error:'Aplicação não autorizada.'});
  if(!req.headers.get('content-type')?.startsWith('application/json'))return respond(415,{error:'Formato inválido.'});
  if(Number(req.headers.get('content-length'))>20000)return respond(413,{error:'Respostas muito longas.'});
  let body;
  try{
   // Bound streamed bodies as well as requests declaring Content-Length.
   const reader=req.body?.getReader();if(!reader)return respond(400,{error:'Respostas ausentes.'});
   const chunks=[];let length=0;
   while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>20000){await reader.cancel();return respond(413,{error:'Respostas muito longas.'});}chunks.push(value);}
   const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   body=JSON.parse(new TextDecoder().decode(bytes));
  }catch{return respond(400,{error:'Respostas inválidas.'});}
  const topKeys=new Set(['id','answers','privacyVersion',...consentKeys]);
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!topKeys.has(k))||
   !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)||
   !body.answers||Array.isArray(body.answers)||typeof body.answers!=='object'||
   Object.entries(body.answers).some(([k,v])=>!answerKeys.has(k)||typeof v!=='string'||v.length>800)||
   consentKeys.some(k=>typeof body[k]!=='boolean')||body.consentPrivacy!==true||body.privacyVersion!=='2026-11-16')return respond(400,{error:'Confira as respostas e a autorização de armazenamento.'});
  try{
   const result=await save(body,req);
   if(result?.saved!==true)throw Error('Storage did not confirm');
   return respond(201,{saved:true,id:body.id});
  }catch(error){
   if(error?.code==='P0429')return respond(429,{error:'Limite temporário de envios. Tente mais tarde.'});
   if(error?.code==='22023')return respond(409,{error:'Este envio já foi concluído com outras respostas.'});
   return respond(503,{error:'Não foi possível salvar agora. Tente novamente.'});
  }
 };
}
