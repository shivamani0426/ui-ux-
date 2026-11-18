import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {server} from '../server.mjs';

test('15A: installable manifest, scalable and maskable app icons',async()=>{
 const m=JSON.parse(await fs.readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
 assert.equal(m.start_url,'/studio');
 assert.equal(m.scope,'/');
 assert.equal(m.display,'standalone');
 assert.ok(m.icons.some(i=>i.purpose==='any'));
 assert.ok(m.icons.some(i=>i.purpose==='maskable'));
 for(const i of m.icons){
   assert.match(await fs.readFile(new URL('../public'+i.src,import.meta.url),'utf8'),/<svg/);
 }
});
test('15A: public static PWA files served with correct cache policy',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
   for(const [url,type] of [
     ['/manifest.webmanifest','application/manifest+json'],
     ['/service-worker.js','text/javascript'],
     ['/pwa-icon.svg','image/svg+xml'],
     ['/pwa-icon-maskable.svg','image/svg+xml']
   ]){
     const response=await fetch(base+url);
     assert.equal(response.status,200,url);
     assert.ok((response.headers.get('content-type')||'').includes(type),url+' must return '+type);
     assert.ok((await response.text()).length>100);
     if(url.includes('worker')||url.includes('manifest'))
       assert.match(response.headers.get('cache-control')||'',/no-cache/);
   }
   const html=await (await fetch(base+'/')).text();
   assert.match(html,/<link rel="manifest"/);
   const missing=await fetch(base+'/private-backup.json');
   assert.equal(missing.status,404,'Static allowlist must remain restrictive');
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('15A: service worker excludes private APIs, OAuth, POST, and remote origins',async()=>{
 const sw=await fs.readFile(new URL('../public/service-worker.js',import.meta.url),'utf8');
 assert.match(sw,/request\.method!=='GET'/);
 assert.match(sw,/path\.startsWith\('\/api\/'\)/);
 assert.match(sw,/path\.startsWith\('\/auth\/'\)/);
 assert.match(sw,/url\.origin!==self\.location\.origin/);
 assert.ok(!/sync\.register|addEventListener\('push'/.test(sw),
   'No private offline write queue or unsolicited push notifications');
});
test('14C: local Figma plugin has no external-network permission and assigned-ID setup',async()=>{
 const manifest=JSON.parse(await fs.readFile(
   new URL('../integrations/figma/manifest.example.json',import.meta.url),'utf8'));
 assert.deepEqual(manifest.networkAccess.allowedDomains,['none']);
 assert.equal(manifest.documentAccess,'dynamic-page');
 assert.match(manifest.id,/REPLACE_WITH_YOUR_FIGMA_PLUGIN_ID/);
});
test('14C: plugin creates editable layers only from approved handoff',async()=>{
 const source=await fs.readFile(new URL('../integrations/figma/code.js',import.meta.url),'utf8');
 const created=[];
 const mockNode=type=>({
   type,children:[],width:0,height:0,
   appendChild(child){this.children.push(child)},
   resize(w,h){this.width=w;this.height=h},
   remove(){this.removed=true}
 });
 const mock={
   ui:{onmessage:null,postMessage(v){this.lastMessage=v}},
   showUI(){},closePlugin(){this.closed=true},notify(){},
   viewport:{center:{x:600,y:700},scrollAndZoomIntoView(){}},
   currentPage:{selection:[]},
   loadFontAsync:async()=>{},
   createFrame(){const n=mockNode('FRAME');created.push(n);return n},
   createText(){const n=mockNode('TEXT');created.push(n);return n},
   createRectangle(){const n=mockNode('RECTANGLE');created.push(n);return n}
 };
 vm.runInNewContext(source,{figma:mock,__html__:'<main></main>',console});
 const payload={
   format:'frontline-design-handoff',schemaVersion:1,
   project:{title:'Student learning',brief:'Study dashboard',approvedRefinement:'No chat'},
   selectedStyles:['minimal'],
   directions:[{name:'Minimal SaaS',layout:'Two columns',palette:['#abcdef']}],
   approved:{
     pages:[{type:'page',title:'Study planner',notes:'Keyboard navigation'}],
     decisions:[{type:'decision',title:'Mobile tabs',notes:''}],
     inspirations:[]
   }
 };
 await mock.ui.onmessage({type:'import',payload});
 assert.ok(mock.currentPage.selection.length===1);
 const root=mock.currentPage.selection[0];
 assert.equal(root.type,'FRAME');
 assert.ok(created.some(n=>n.type==='TEXT'&&n.characters==='Study planner'));
 assert.ok(created.some(n=>n.type==='TEXT'&&n.characters==='Mobile tabs'));
 assert.ok(created.some(n=>n.type==='RECTANGLE'));
 assert.equal(mock.closed,true);
 const invalid={...payload,approved:{...payload.approved,pages:Array.from({length:25},()=>({title:'Bad',notes:''}))}};
 mock.closed=false;
 await mock.ui.onmessage({type:'import',payload:invalid});
 assert.match(mock.ui.lastMessage.message,/Invalid pages/);
 assert.equal(mock.closed,false);
});
