import test from 'node:test';
import assert from 'node:assert/strict';
import {LIVE_SOURCES,canonicalIndexedUrl,indexedReference,discoveryTerms,
  discoverLiveSources,clearDiscoveryCacheForTests} from '../live-source-discovery.mjs';
import {server} from '../server.mjs';
const key='brave_TEST_ONLY_012345678901234567890';
test('Original source registry covers 7 animation and 7 inspiration providers',()=>{
  assert.equal(LIVE_SOURCES.length,14);
  assert.equal(LIVE_SOURCES.filter(x=>x.kind==='animation').length,7);
  assert.equal(LIVE_SOURCES.filter(x=>x.kind==='inspiration').length,7);
  assert.ok(LIVE_SOURCES.some(x=>x.id==='kage'));
  assert.ok(LIVE_SOURCES.some(x=>x.id==='21st'));
  assert.ok(LIVE_SOURCES.some(x=>x.id==='lapa'&&x.linkOnly));
});
test('Search keywords are bounded; private email/URL does not leave server',()=>{
  const brief='Build AI student dashboard for jane.private@example.org with https://intranet.example.org/admin and analytics';
  const query=discoveryTerms(brief);
  assert.ok(query.includes('student'));
  assert.ok(!query.includes('jane')&&!query.includes('intranet')&&!query.includes('example'));
  assert.ok(query.split(' ').length<=7);
});
test('Reject source lookalikes, unsafe hosts, scripts, private paths and arbitrary prompts',()=>{
  const provider=LIVE_SOURCES.find(x=>x.id==='kage');
  for(const url of ['https://kage.design.evil.invalid/item','http://kage.design/abc',
    'https://u:p@kage.design/design/abc','javascript:alert(1)',
    'https://kage.design/','https://kage.design/api/private',
    'https://kage.design/download/abc.pdf','https://kage.design:8443/item']){
    assert.equal(canonicalIndexedUrl(url,provider),null,url);
  }
  const found=indexedReference({
    title:'Original designer hero component',
    url:'https://kage.design/designs/hero?utm=tracker',
    description:'THIS IS NOT AN ORIGINAL PROMPT',
    prompt:'A faked publisher prompt from untrusted search index'
  },provider);
  assert.equal(found.site,'https://kage.design/designs/hero');
  assert.equal(found.originalPrompt,null);
  assert.equal(found.originalPromptStatus,'not-verified');
  assert.ok(!JSON.stringify(found).includes('THIS IS NOT'));
  assert.ok(!JSON.stringify(found).includes('faked publisher prompt'));
});
test('Authorized index search delivers only matching original publisher links',async()=>{
  clearDiscoveryCacheForTests();
  const seen=[];
  const transport=async(url,options)=>{
    const u=new URL(url);
    seen.push({url:u,options});
    const site=u.searchParams.get('q').match(/^site:([^ ]+)/)?.[1];
    return new Response(JSON.stringify({web:{results:[
      {url:'https://'+site+'/components/hero',title:'Hero animation component'},
      {url:'https://'+site+'.attacker.invalid/hijack',title:'Fake malicious result'},
      {url:'https://'+site+'/components/hero',title:'Duplicate'},
      {url:'https://totally-unrelated.invalid/another',title:'Unrelated'}
    ]}}),{status:200});
  };
  const result=await discoverLiveSources('Build animated student portal',{
    apiKey:key,transport,now:()=>100000});
  assert.equal(result.status,'ready');
  assert.equal(result.matches.length,13, // Codrops requires /codrops/ prefix; reject unrelated path
    'No invalid Codrops path or malicious host may be treated as an original source');
  assert.ok(result.matches.every(x=>x.indexVerified&&x.originalPrompt===null));
  assert.ok(result.matches.every(x=>x.site.startsWith('https://')));
  assert.equal(seen.length,14);
  assert.ok(seen.every(x=>x.url.hostname==='api.search.brave.com'));
  assert.ok(seen.every(x=>x.options.headers['X-Subscription-Token']===key));
  const again=await discoverLiveSources('Build animated student portal',{apiKey:key,transport,now:()=>100001});
  assert.equal(again.matches.length,13);
  assert.equal(seen.length,14,'Cache prevents repeated provider API calls');
});
test('Unconfigured source search and provider failures never revert to curated fake recommendations',async()=>{
  clearDiscoveryCacheForTests();
  const missing=await discoverLiveSources('student dashboard',{apiKey:''});
  assert.equal(missing.status,'not-configured');
  assert.deepEqual(missing.matches,[]);
  assert.equal(missing.sources.length,14);
  const failed=await discoverLiveSources('student dashboard',{
    apiKey:key,transport:async()=>new Response('',{status:429}),now:()=>100});
  assert.equal(failed.status,'unavailable');
  assert.deepEqual(failed.matches,[]);
});
test('API no longer exposes archived inspiration sites or Frontline-made publisher prompts',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 let cookie='';
 async function call(path,method='GET',body){
   const response=await fetch(base+path,{method,headers:{
     ...(cookie?{Cookie:cookie}:{}),
     ...(body===undefined?{}:{'Content-Type':'application/json'})
   },body:body===undefined?undefined:JSON.stringify(body)});
   if(!cookie&&response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
   return {status:response.status,data:await response.json()};
 }
 try{
   const catalog=await call('/api/catalog');
   assert.deepEqual(catalog.data.references,[]);
   const create=await call('/api/projects','POST',{brief:'Create a learning dashboard for students and teachers'});
   assert.equal(create.status,201);
   assert.ok(create.data.project.recommendations.designs.every(x=>x.references.length===0));
   const id=create.data.project.id;
   const discovered=await call('/api/projects/'+id+'/inspirations');
   assert.equal(discovered.status,200);
   assert.equal(discovered.data.discovery.status,'not-configured');
   assert.deepEqual(discovered.data.matches,[]);
   assert.equal(discovered.data.sources.length,14);
   assert.equal(discovered.data.librarySize,0);
   const fake=await call('/api/projects/'+id+'/inspirations','PUT',{sourceId:'casa',selected:true});
   assert.equal(fake.status,404);
   const prompt=await call('/api/projects/'+id+'/inspirations/prompt','POST',{});
   assert.equal(prompt.status,409);
   assert.ok(!('prompt' in prompt.data));
   assert.deepEqual(prompt.data.sources,[]);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
