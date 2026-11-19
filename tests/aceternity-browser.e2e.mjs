import assert from 'node:assert/strict';
import {chromium,firefox} from 'playwright';
import {server} from '../server.mjs';
import {clearAceternityCacheForTests} from '../aceternity-official.mjs';
const items=[
 'spotlight','background-beams','hero-highlight','glowing-stars','sparkles',
 'floating-navbar','animated-tooltip','bento-grid','card-spotlight','animated-modal',
 'hero-parallax','aurora-background','infinite-moving-cards','3d-card',
 'text-generate-effect','moving-border','carousel','tracing-beam','apple-cards-carousel',
 'background-gradient','direction-aware-hover','wavy-background','animated-testimonials'
].map(name=>({name,
 title:name==='spotlight'?'Spotlight':name.split('-').join(' '),
 description:name==='spotlight'?'A glowing spotlight hero effect':'Original animated React component',
 documentationUrl:'https://ui.aceternity.com/components/'+name,
 categories:['hero','animation']}));
const old=globalThis.fetch,flag=process.env.FRONTLINE_ACETERNITY_TEST_MOCK;
process.env.FRONTLINE_ACETERNITY_TEST_MOCK='1';
globalThis.fetch=(url,options)=>{
 if(String(url)==='https://ui.aceternity.com/api/components')
   return Promise.resolve(new Response(JSON.stringify({
     meta:{website:'https://ui.aceternity.com'},components:items
   }),{status:200,headers:{'Content-Type':'application/json'}}));
 return old(url,options);
};
clearAceternityCacheForTests();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let failed=false;
const origin='http://127.0.0.1:'+server.address().port;
try{
 for(const [name,browserType] of [['Chromium',chromium],['Firefox',firefox]]){
   let browser;
   try{
     browser=await browserType.launch({headless:true});
     const page=await browser.newPage({viewport:{width:1280,height:800}});
     const errors=[];
     page.on('pageerror',e=>errors.push(e.message));
     await page.goto(origin+'/studio',{waitUntil:'domcontentloaded',timeout:18000});
     await page.locator('.composer textarea').fill(
       'Build a glowing hero spotlight animation for a developer landing page');
     await page.locator('.composer textarea').press('Enter');
     const card=page.locator('.inspiration-component-card').filter({hasText:'Aceternity UI'}).first();
     await card.waitFor({timeout:16000});
     assert.match(await card.innerText(),/Spotlight/i);
     const link=card.getByRole('link',{name:'Open original Aceternity UI Spotlight'});
     assert.equal(await link.getAttribute('href'),'https://ui.aceternity.com/components/spotlight');
     assert.match(await card.innerText(),/No publisher-authored design prompt was supplied/i);
     await card.getByRole('button',{name:'Save component link'}).click();
     await card.getByRole('button',{name:'Saved component'}).waitFor({timeout:7000});
     assert.deepEqual(errors,[],name+' unexpected JavaScript errors');
     console.log(name+' genuine Aceternity source URL, truthful prompt status, and private save passed');
   }catch(e){failed=true;console.error(name+' Aceternity UI test failed: '+e.stack)}
   finally{await browser?.close()}
 }
}finally{
 clearAceternityCacheForTests();globalThis.fetch=old;
 if(flag===undefined)delete process.env.FRONTLINE_ACETERNITY_TEST_MOCK;
 else process.env.FRONTLINE_ACETERNITY_TEST_MOCK=flag;
 await new Promise(resolve=>server.close(resolve));
}
if(failed)process.exitCode=1;
