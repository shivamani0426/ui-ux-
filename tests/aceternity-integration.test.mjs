import test from 'node:test';
import assert from 'node:assert/strict';
import {server} from '../server.mjs';
import {clearAceternityCacheForTests} from '../aceternity-official.mjs';

export const items=[
 'spotlight','background-beams','hero-highlight','glowing-stars','sparkles',
 'floating-navbar','animated-tooltip','bento-grid','card-spotlight','animated-modal',
 'hero-parallax','aurora-background','infinite-moving-cards','3d-card',
 'text-generate-effect','moving-border','carousel','tracing-beam','apple-cards-carousel',
 'background-gradient','direction-aware-hover','wavy-background','animated-testimonials'
].map(name=>({name,title:name.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' '),
 description:name==='spotlight'?'Glowing spotlight hero effect with pointer interaction':
   'An animated React component from the official Aceternity catalogue',
 documentationUrl:'https://ui.aceternity.com/components/'+name,
 categories:name==='spotlight'?['hero','effects']:['animations']}));
export const fixture={meta:{website:'https://ui.aceternity.com'},components:items};
export const installAceternityMock=()=>{
 clearAceternityCacheForTests();
 const old=globalThis.fetch,flag=process.env.FRONTLINE_ACETERNITY_TEST_MOCK;
 process.env.FRONTLINE_ACETERNITY_TEST_MOCK='1';
 globalThis.fetch=(url,opts)=>{
  if(String(url)==='https://ui.aceternity.com/api/components')
   return Promise.resolve(new Response(JSON.stringify(fixture),{
     status:200,headers:{'Content-Type':'application/json'}}));
  return old(url,opts);
 };
 return ()=>{
   globalThis.fetch=old;
   if(flag===undefined)delete process.env.FRONTLINE_ACETERNITY_TEST_MOCK;
   else process.env.FRONTLINE_ACETERNITY_TEST_MOCK=flag;
   clearAceternityCacheForTests();
 };
};
test('Frontline API returns authentic Aceternity component URL, private selection and no fake prompt',async()=>{
 const restore=installAceternityMock();
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const root='http://127.0.0.1:'+server.address().port;
 const client=()=>{
   let cookie='';
   return async(path,method='GET',body)=>{
     const res=await fetch(root+path,{method,headers:{
       ...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})
     },body:body?JSON.stringify(body):undefined});
     cookie=res.headers.get('set-cookie')?.split(';')[0]||cookie;
     return {status:res.status,data:await res.json()};
   };
 };
 const alice=client(),bob=client();
 try{
   const created=await alice('/api/projects','POST',{
     brief:'Design a glowing hero spotlight effect for a software landing page'});
   assert.equal(created.status,201);
   const id=created.data.project.id,endpoint='/api/projects/'+id+'/inspirations';
   const view=await alice(endpoint);
   assert.equal(view.status,200);
   const found=view.data.componentMatches.find(x=>x.site==='https://ui.aceternity.com/components/spotlight');
   assert.ok(found,'Publisher component URL must come from the original JSON catalogue');
   assert.equal(found.provider,'Aceternity UI');
   assert.equal(found.originalPrompt,null);
   assert.equal(found.originalPromptStatus,'not-published');
   assert.equal(view.data.componentDiscovery.providers.find(x=>x.provider==='Aceternity UI').status,'ready');
   assert.equal((await bob(endpoint)).status,404);
   const saved=await alice(endpoint,'PUT',{sourceId:found.id,selected:true});
   assert.equal(saved.status,200);
   assert.ok(saved.data.selected.includes(found.id));
   const workspace=await alice('/api/projects/'+id+'/workspace');
   assert.equal(workspace.status,200);
   assert.ok(workspace.data.savedInspirations.some(x=>x.site===found.site));
   const removed=await alice(endpoint,'PUT',{sourceId:found.id,selected:false});
   assert.equal(removed.status,200);
   assert.ok(!removed.data.selected.includes(found.id));
   assert.equal((await alice(endpoint,'PUT',{sourceId:'fake-aceternity',selected:true})).status,404);
 }finally{
   restore();
   await new Promise(resolve=>server.close(resolve));
 }
});
