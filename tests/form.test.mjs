import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {chromium} from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

test('form: edição, pular, erro recuperável e confirmação do servidor',async()=>{
 const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(readFileSync(new URL('../index.html',import.meta.url)));}).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 let calls=0,submitted,firstSubmission;
 await page.route('**/functions/v1/elab-profile-submit',async route=>{
  calls++;submitted=route.request().postDataJSON();if(calls===1)firstSubmission=submitted;
  await route.fulfill({status:calls===1?503:201,contentType:'application/json',body:JSON.stringify(calls===1?{error:'Falha temporária'}:{saved:true,id:submitted.id})});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 assert.equal(await page.locator('.cover-art').count(),0,'capa sem ilustração');
 assert.equal(await page.getByText('Antes da sua visita',{exact:true}).count(),0);
 await page.locator('#start').click();
 assert.equal(await page.locator('.suggestion').count(),0,'nome sem balões');
 await page.locator('#answer').fill('Cliente fictícia');
 await page.locator('#next').click();
 await page.locator('#skip').click();
 await page.locator('#back').click();
 assert.equal(await page.locator('#answer').inputValue(),'','pular limpa resposta');
 await page.locator('#back').click();
 assert.equal(await page.locator('#answer').inputValue(),'Cliente fictícia');
 await page.locator('#next').click();
 for(let i=0;i<3;i++)await page.locator('#skip').click();
 assert.equal(await page.locator('.suggestion').allTextContents().then(v=>v.includes('café expresso')),true);
 await page.getByRole('button',{name:'café expresso',exact:true}).click();
 await page.locator('#next').click();
 for(let i=0;i<8;i++)await page.locator('#skip').click();
 assert.match(await page.locator('h1').textContent(),/valet/i);
 assert.equal(await page.locator('#plate').count(),0);
 await page.locator('#answer').fill('Carro fictício · ABC1D23');
 await page.locator('#next').click();
 await page.locator('input[name=contact][value=no]').check();
 await page.locator('#privacy').check();
 await page.locator('#next').click();
 await page.getByRole('alert').waitFor();
 assert.equal(await page.getByText('Seu perfil foi salvo.').count(),0,'falha não confirma envio');
 assert.equal(await page.locator('#privacy').isDisabled(),true,'uncertain outcome keeps exact retry snapshot');
 assert.equal(await page.locator('#back').isDisabled(),true);
 await page.locator('#next').click();
 await page.getByText('Seu perfil foi salvo.').waitFor();
 assert.deepEqual(submitted,firstSubmission);
 assert.equal(calls,2);
 assert.equal(submitted.answers.name,'Cliente fictícia');
 assert.equal(submitted.answers.ritual,'café expresso');
 assert.equal(submitted.answers.car,'Carro fictício · ABC1D23');
 assert.equal(submitted.consentContact,false);
 assert.equal(await page.evaluate(()=>localStorage.length),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }finally{await browser.close();server.close();}
});
test('revised copy has a short cover and no auxiliary phrases on questions',async()=>{
 const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(readFileSync(new URL('../index.html',import.meta.url)));}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}`);
  assert.equal(await page.getByText('Responda só o que quiser.',{exact:true}).count(),0);
  await page.locator('#start').click();
  for(let i=0;i<14;i++){assert.equal(await page.locator('.hint').count(),0);assert.equal(await page.locator('#skip').isVisible(),true);await page.locator('#skip').click()}
 }finally{await browser.close();server.close()}
});
