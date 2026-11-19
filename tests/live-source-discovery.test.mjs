import test from 'node:test';
import assert from 'node:assert/strict';
import {LIVE_SOURCES,canonicalIndexedUrl,indexedReference,discoveryTerms,
 discoverLiveSources,clearDiscoveryCacheForTests} from '../live-source-discovery.mjs';
import {sourceUrlForKage,findKageOriginals,verifiedKagePrompt,toolArguments} from '../kage-publisher.mjs';
import {mockKageFetch,originalPrompt} from './kage-mcp-fixture.mjs';
import {server} from '../server.mjs';

test('14 original domains are listed; only first-party prompt integration claims verified prompts',()=>{
  assert.equal(LIVE_SOURCES.length,14);
  assert.equal(LIVE_SOURCES.filter(x=>x.kind==='animation').length,7);
  assert.equal(LIVE_SOURCES.filter(x=>x.kind==='inspiration').length,7);
  assert.ok(LIVE_SOURCES.some(x=>x.id==='kage'));
  assert.ok(LIVE_SOURCES.some(x=>x.id==='21st'));
});
test('Search terms are bounded and exclude URLs and email',()=>{
  const q=discoveryTerms('Build student dashboard for Jane at private@example.org https://internal.example.org/chat');
  assert.match(q,/student/);assert.doesNotMatch(q,/jane|internal|example/);
  assert.ok(q.split(' ').length<=7);
});
test('Only official Kage slugs and trusted publisher URLs are eligible',()=>{
  const provider=LIVE_SOURCES.find(x=>x.id==='kage');
  for(const site of ['https://kage.design.evil.invalid/designs/x','http://kage.design/designs/x',
    'https://kage.design/','javascript:alert(1)','https://kage.design/api/private']){
    assert.equal(canonicalIndexedUrl(site,provider),null,site);
  }
  assert.equal(canonicalIndexedUrl('https://kage.design/designs/tracker?utm=bad',provider),
    'https://kage.design/designs/tracker');
  assert.equal(sourceUrlForKage({slug:'student-dashboard-original'}),
    'https://kage.design/designs/student-dashboard-original');
  assert.equal(sourceUrlForKage({url:'https://kage.design.attacker.test/designs/fake',slug:'bad/slug'}),null);
  assert.equal(sourceUrlForKage({url:'https://kage.design.attacker.test/designs/fake',slug:'valid-slug'}),null,
    'Conflicting hostile URL cannot be repaired into a fake source link');
  const fake=indexedReference({url:'https://kage.design/designs/valid',
    title:'Authentic original',prompt:'FORGED AI PROMPT'},provider);
  assert.equal(fake.originalPrompt,null);
  assert.equal(fake.originalPromptStatus,'not-verified');
});
test('Real Kage MCP protocol: only get_design can authorize verbatim prompts and links',async()=>{
  const official=await findKageOriginals('student learning dashboard',{transport:mockKageFetch});
  assert.equal(official.status,'ready');
  assert.equal(official.matches.length,1);
  assert.equal(official.matches[0].url,'https://kage.design/designs/student-dashboard-original');
  assert.equal(official.matches[0].originalPrompt,originalPrompt);
  assert.equal(official.matches[0].originalPromptStatus,'verified-publisher');
  assert.match(official.matches[0].originalPromptHash,/^[a-f0-9]{64}$/);
  assert.equal(verifiedKagePrompt({structuredContent:{design:{
    slug:'different-design',prompt:originalPrompt
  }}},official.matches[0].url),null,'Do not attribute a prompt to a mismatched design');
  assert.equal(verifiedKagePrompt({structuredContent:{design:{
    slug:'student-dashboard-original',description:'Made up, not a publisher prompt'
  }}},official.matches[0].url),null,'Description is NOT an original prompt');
});
test('Unsupported MCP input schemas fail closed instead of inventing arguments',()=>{
  assert.equal(toolArguments({inputSchema:{properties:{},required:['mystery']}},'get','valid-slug'),null);
});
test('Source discovery gives real publisher prompts, links and 13 link-only sites',async()=>{
  clearDiscoveryCacheForTests();
  const result=await discoverLiveSources('student dashboard',{
    transport:mockKageFetch,now:()=>100000});
  assert.equal(result.status,'partial');
  assert.equal(result.matches.length,1);
  assert.equal(result.matches[0].originalPrompt,originalPrompt);
  assert.equal(result.matches[0].originalPromptStatus,'verified-publisher');
  assert.equal(result.sources.length,14);
  assert.equal(result.providerStatus.filter(x=>x.status==='link-only').length,13);
  const again=await discoverLiveSources('student dashboard',{transport:mockKageFetch,now:()=>100100});
  assert.deepEqual(again.matches,result.matches);
});
test('Search result without verified get_design prompt is NOT a recommended match',async()=>{
  clearDiscoveryCacheForTests();
  const withoutPrompt=async(url,options)=>{
    const request=JSON.parse(options.body);
    if(request.method==='tools/call'&&request.params.name==='get_design'){
      return new Response(JSON.stringify({jsonrpc:'2.0',id:request.id,result:{
        structuredContent:{design:{slug:'student-dashboard-original',
          name:'Student dashboard original from Kage',
          description:'An attractive design, but no published prompt is present.'}}
      }}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    return mockKageFetch(url,options);
  };
  const response=await discoverLiveSources('student learning dashboard',{
    transport:withoutPrompt,now:()=>100000});
  assert.equal(response.status,'no-matches');
  assert.deepEqual(response.matches,[]);
  assert.equal(response.sources.length,14);
});

test('Provider failure returns zero fake prompts and real provider directory only',async()=>{
  clearDiscoveryCacheForTests();
  const r=await discoverLiveSources('college dashboard',{
    transport:async()=>new Response('',{status:503}),now:()=>100000});
  assert.equal(r.status,'unavailable');
  assert.deepEqual(r.matches,[]);
  assert.equal(r.sources.length,14);
});
test('API no longer returns hardcoded websites or generated prompts under publisher name',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 let cookie='';
 const client=async(path,method='GET',body)=>{
   const res=await fetch(base+path,{method,headers:{
     ...(cookie?{Cookie:cookie}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})
   },body:body===undefined?undefined:JSON.stringify(body)});
   cookie=res.headers.get('set-cookie')?.split(';')[0]||cookie;
   return {status:res.status,data:await res.json()};
 };
 try{
   const catalog=await client('/api/catalog');
   assert.deepEqual(catalog.data.references,[]);
   const created=await client('/api/projects','POST',{brief:'Build a student learning dashboard'});
   assert.equal(created.status,201);
   assert.ok(created.data.project.recommendations.designs.every(d=>d.references.length===0));
   const id=created.data.project.id;
   const listed=await client('/api/projects/'+id+'/inspirations');
   assert.equal(listed.status,200);
   assert.deepEqual(listed.data.matches,[]);
   assert.equal(listed.data.sources.length,14);
   const fake=await client('/api/projects/'+id+'/inspirations','PUT',{sourceId:'casa',selected:true});
   assert.equal(fake.status,404);
   const fakePrompt=await client('/api/projects/'+id+'/inspirations/prompt','POST',{});
   assert.equal(fakePrompt.status,409);
   assert.equal(fakePrompt.data.prompt,undefined);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
