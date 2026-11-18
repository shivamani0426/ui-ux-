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
 assert.ok(m.icons.some(i=>i.type==='image/png'&&i.purpose==='any'&&i.sizes==='192x192'));
 assert.ok(m.icons.some(i=>i.type==='image/png'&&i.purpose==='maskable'&&i.sizes==='512x512'));
 for(const i of m.icons){
   const bytes=await fs.readFile(new URL('../public'+i.src,import.meta.url));
   if(i.type==='image/svg+xml')assert.match(bytes.toString('utf8'),/<svg/);
   else{
     assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10],
       'Native install icon must be real PNG bytes, not renamed SVG');
     assert.equal(bytes.readUInt32BE(16),Number(i.sizes.split('x')[0]));
     assert.equal(bytes.readUInt32BE(20),Number(i.sizes.split('x')[1]));
   }
 }
 const apple=await fs.readFile(new URL('../public/apple-touch-icon.png',import.meta.url));
 assert.deepEqual([...apple.subarray(0,8)],[137,80,78,71,13,10,26,10]);
 assert.equal(apple.readUInt32BE(16),180);
});
test('15A: public static PWA files served with correct cache policy',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
   for(const [url,type] of [
     ['/manifest.webmanifest','application/manifest+json'],
     ['/service-worker.js','text/javascript'],
     ['/pwa-icon.svg','image/svg+xml'],
     ['/pwa-icon-maskable.svg','image/svg+xml'],
     ['/pwa-icon-192.png','image/png'],
     ['/pwa-icon-maskable-512.png','image/png'],
     ['/apple-touch-icon.png','image/png']
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
   assert.match(html,/<link rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png"/);
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
 assert.ok(created.some(n=>n.type==='TEXT'&&n.textAutoResize==='HEIGHT'),
   'Long imported text must resize based on Figma glyph wrapping');
 assert.ok(created.some(n=>n.type==='TEXT'&&n.characters==='Mobile tabs'));
 assert.ok(created.some(n=>n.type==='RECTANGLE'));
 assert.equal(mock.closed,true);
 const invalid={...payload,approved:{...payload.approved,pages:Array.from({length:25},()=>({title:'Bad',notes:''}))}};
 mock.closed=false;
 await mock.ui.onmessage({type:'import',payload:invalid});
 assert.match(mock.ui.lastMessage.message,/Invalid pages/);
 assert.equal(mock.closed,false);
});


test('15B: first PWA installation precaches public JS/CSS before any controlled reload',async()=>{
  const code=await fs.readFile(new URL('../public/service-worker.js',import.meta.url),'utf8');
  const handlers={};
  const stored=new Map();
  const requests=[];
  const html='<!doctype html><link rel="stylesheet" crossorigin href="/assets/index-abc123.css"/>'+
    '<script type="module" crossorigin src="/assets/index-def456.js"></script>';
  const network=async path=>{
    requests.push(path);
    if(path==='/')return new Response(html,{status:200});
    if(['/favicon.svg','/pwa-icon.svg','/manifest.webmanifest',
      '/assets/index-abc123.css','/assets/index-def456.js'].includes(path))
      return new Response('public-asset',{status:200});
    throw Error('Unapproved cache request: '+path);
  };
  const cachesMock={
    async open(name){
      if(!stored.has(name))stored.set(name,new Map());
      const entries=stored.get(name);
      return {
        async addAll(paths){
          for(const path of paths)entries.set(path,await network(path));
        },
        async match(path){return entries.get(path)?.clone()||undefined;}
      };
    }
  };
  const fakeSelf={
    location:{origin:'https://frontline.example'},
    addEventListener(name,callback){handlers[name]=callback;},
    clients:{claim:async()=>{}}
  };
  vm.runInNewContext(code,{self:fakeSelf,caches:cachesMock,fetch:network,
    URL,Response,Promise,console});
  let pending=null;
  handlers.install({waitUntil(p){pending=p;}});
  await pending;
  assert.ok(requests.includes('/assets/index-def456.js'));
  assert.ok(requests.includes('/assets/index-abc123.css'));
  assert.ok(!requests.some(path=>path.startsWith('/api/')||path.startsWith('/auth/')));
  const shell=[...stored.values()].find(cache=>cache.has('/'));
  const assets=[...stored.values()].find(cache=>cache.has('/assets/index-def456.js'));
  assert.ok(shell&&assets);
  assert.ok(assets.has('/assets/index-abc123.css'));
});
test('15B: installation refuses a misleading incomplete shell without JavaScript',async()=>{
  const code=await fs.readFile(new URL('../public/service-worker.js',import.meta.url),'utf8');
  const handlers={};
  const cachesMock={
    async open(){return {
      async addAll(){},
      async match(){return new Response('<html>Incomplete deployment</html>');}
    }}
  };
  vm.runInNewContext(code,{self:{
    location:{origin:'https://frontline.example'},
    addEventListener(name,fn){handlers[name]=fn;},
    clients:{claim:async()=>{}}
  },caches:cachesMock,fetch:async()=>new Response(''),URL,Response,Promise});
  let pending=null;handlers.install({waitUntil(p){pending=p;}});
  await assert.rejects(pending,/bundle was not found/);
});


test('14C: full approved brief is not truncated and Figma importer rejects oversize payload',async()=>{
 const source=await fs.readFile(new URL('../integrations/figma/code.js',import.meta.url),'utf8');
 const nodes=[];
 const make=type=>({type,width:0,height:0,
   children:[],appendChild(x){this.children.push(x)},resize(w,h){this.width=w;this.height=h},
   remove(){this.removed=true}});
 const figma={
   ui:{onmessage:null,postMessage(msg){this.error=msg.message}},
   showUI(){},closePlugin(){this.closed=true},notify(){},
   viewport:{center:{x:500,y:500},scrollAndZoomIntoView(){}},
   currentPage:{selection:[]},loadFontAsync:async()=>{},
   createFrame(){const n=make('FRAME');nodes.push(n);return n},
   createText(){const n=make('TEXT');nodes.push(n);return n},
   createRectangle(){const n=make('RECTANGLE');nodes.push(n);return n}
 };
 vm.runInNewContext(source,{figma,__html__:'',console});
 const brief='Always include accessible keyboard navigation. '.repeat(28);
 const data={format:'frontline-design-handoff',schemaVersion:1,
   project:{title:'Accessible portal',brief,approvedRefinement:'No checkout'},
   selectedStyles:['minimal'],
   directions:[{name:'Minimal',description:'Readable',layout:'Two columns',
     typography:'Sans serif',motion:'Reduced motion',tradeoff:'Less spectacle',
     palette:['#334455']}],
   approved:{pages:[{title:'Dashboard',notes:'Important details '.repeat(15)}],
     decisions:[],inspirations:[]}};
 await figma.ui.onmessage({type:'import',payload:data});
 assert.equal(figma.closed,true);
 assert.ok(nodes.some(n=>n.type==='TEXT'&&n.characters==='Brief: '+brief.trim()));
 assert.ok(nodes.some(n=>n.type==='TEXT'&&n.characters.includes('Reduced motion')));
 assert.ok(nodes.some(n=>n.type==='TEXT'&&n.characters.includes('Less spectacle')));
 const unsafe=JSON.parse(JSON.stringify(data));unsafe.project.brief='X'.repeat(71000);
 figma.closed=false;
 await figma.ui.onmessage({type:'import',payload:unsafe});
 assert.equal(figma.closed,false);
 assert.match(figma.ui.error,/Select a Frontline approved-design JSON file/);
});
