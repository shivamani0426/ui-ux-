import {installKageMock,originalPrompt} from './kage-mcp-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {rankInspirations,makeSelectionPrompt} from '../inspiration-engine.mjs';
import {REFERENCES} from '../design-engine.mjs';
import {server} from '../server.mjs';

function client(base){
  let cookie='';
  return async (path,method='GET',payload)=>{
    const headers={};
    if(cookie)headers.Cookie=cookie;
    if(payload!==undefined)headers['Content-Type']='application/json';
    const response=await fetch(base+path,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload)});
    if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
    return {status:response.status,data:await response.json()};
  };
}
test('Explainable ranking highlights domain matches without invented visual scans',()=>{
  const refs=[
    {id:'learning',name:'Learning Portal',site:'https://example.org/learning',category:'Education',tags:['education','dashboard'],styles:['minimal'],score:7.1},
    {id:'store',name:'Storefront',site:'https://example.org/store',category:'Retail',tags:['ecommerce','checkout'],styles:['creative'],score:9.3},
    {id:'studio',name:'Portfolio Studio',site:'https://example.org/creative',category:'Portfolio',tags:['portfolio','editorial'],styles:['creative'],score:8.3}
  ];
  const ranked=rankInspirations('Design a college student course dashboard',refs);
  assert.equal(ranked[0].id,'learning');
  assert.ok(ranked[0].matchScore>ranked[1].matchScore);
  assert.ok(ranked[0].reasons.some(x=>x.includes('education')));
  assert.ok(ranked.every(x=>!x.imageUrl),'No invented remote previews');
  const personal=rankInspirations('Design an original website',refs,{favoriteTags:['portfolio']});
  assert.equal(personal[0].id,'studio');
  assert.equal(personal[0].personalized,true);
});
test('Selection prompt describes original design deliverables, not cloned websites',()=>{
  const prompt=makeSelectionPrompt({brief:'Student learning platform'},REFERENCES.slice(0,2));
  assert.match(prompt,/ORIGINAL/);
  assert.match(prompt,/Student learning platform/);
  assert.match(prompt,/accessib/i);
  assert.match(prompt,/Do not copy layouts/);
  assert.throws(()=>makeSelectionPrompt({brief:'Any project'},[]),/Select at least one/);
});
test('Select API saves publisher-indexed links, refuses synthetic prompts, and isolates guests',async()=>{
  const restoreMock=installKageMock();

  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const alice=client(base),bob=client(base);
  try{
    const start=await alice('/api/projects','POST',{brief:'Create a modern college student learning dashboard with clear navigation'});
    assert.equal(start.status,201);
    const id=start.data.project.id;
    const path='/api/projects/'+id+'/inspirations';
    const a=await alice(path);
    assert.equal(a.status,200);
    assert.equal(a.data.librarySize,1);
    assert.equal(a.data.sources.length,14);
    assert.ok(a.data.matches.every(item=>item.originalPromptStatus==='verified-publisher'));
    assert.equal(a.data.matches[0].originalPrompt,originalPrompt);
    assert.ok(a.data.matches.every(item=>item.id.startsWith('live_')));
    assert.ok(a.data.matches.length>=10);
    assert.equal(a.data.selected.length,0);
    assert.ok(a.data.matches[0].reasons.length>0);
    const forbidden=await bob(path);
    assert.equal(forbidden.status,404);
    const invalid=await alice(path,'PUT',{sourceId:'not-real',selected:true});
    assert.equal(invalid.status,404);
    const unsafe=await alice(path,'PUT',{sourceId:'../../foo',selected:true});
    assert.equal(unsafe.status,400);
    const first=a.data.matches[0].id;
    const save=await alice(path,'PUT',{sourceId:first,selected:true});
    assert.equal(save.status,200);
    assert.deepEqual(save.data.selected,[first]);
    const again=await alice(path);
    assert.deepEqual(again.data.selected,[first]);
    const otherSave=await bob(path,'PUT',{sourceId:first,selected:true});
    assert.equal(otherSave.status,404);
    const exported=await alice(path+'/prompt','POST',{});
    assert.equal(exported.status,409);
    assert.equal(exported.data.prompt,undefined);
    assert.deepEqual(exported.data.sources.map(x=>x.originalPromptStatus),['not-verified']);
    const remove=await alice(path,'PUT',{sourceId:first,selected:false});
    assert.equal(remove.status,200);
    assert.deepEqual(remove.data.selected,[]);
    const noPrompt=await alice(path+'/prompt','POST',{});
    assert.equal(noPrompt.status,409);
    const feedback=await alice('/api/profile','DELETE');
    assert.equal(feedback.status,200);
    const deleted=await alice(path);
    assert.equal(deleted.status,404);
  }finally{
    restoreMock();
    await new Promise(resolve=>server.close(resolve));
  }
});

test('Saved inspiration prompts retain explicit requirements without claiming visual scans',()=>{
  const p={brief:'Design a student learning dashboard with an AI tutor and calendar. Must keep existing backend.'};
  const prompt=makeSelectionPrompt(p,REFERENCES.slice(0,2));
  assert.match(prompt,/PROJECT UNDERSTANDING/);
  assert.match(prompt,/Students \/ learners/);
  assert.match(prompt,/AI tutor/);
  assert.match(prompt,/Calendar and schedule/);
  assert.match(prompt,/Preserve existing backend/);
  assert.match(prompt,/Do not copy layouts/);
});
