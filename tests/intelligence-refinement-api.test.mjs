import test from 'node:test';
import assert from 'node:assert/strict';
import {server} from '../server.mjs';

test('Milestone 11 private intelligence refinement persists, preserves chat and rejects other visitors',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const cookies=['',''];
  const call=async(who,path,method='GET',data)=>{
    const headers={};
    if(cookies[who])headers.Cookie=cookies[who];
    if(data!==undefined)headers['Content-Type']='application/json';
    const response=await fetch(base+path,{method,headers,
      body:data===undefined?undefined:JSON.stringify(data)});
    const set=response.headers.get('set-cookie');
    if(set){const guest=set.split(';').find(x=>x.includes('uic_guest='));if(guest)cookies[who]=guest.trim().split(';')[0];}
    return {status:response.status,body:await response.json()};
  };
  const brief='Design an accessible education dashboard for students with assignments, calendar, messaging and course progress.';
  try{
    const created=await call(0,'/api/projects','POST',{brief});
    assert.equal(created.status,201);
    const id=created.body.project.id;
    const initial=created.body.project.recommendations;
    assert.equal(initial.category,'Education');
    assert.ok(initial.analysis.features.some(f=>f.id==='messages'));
    const sent=await call(0,'/api/projects/'+id+'/messages','POST',{
      message:'Keep the class assignments easy to find.',
      styles:['minimal']
    });
    assert.equal(sent.status,200);
    const before=sent.body.messages.length;
    assert.ok(before>=2);
    const unauthorized=await call(1,'/api/projects/'+id+'/intelligence','POST',{
      refinement:'Remove messaging and keep calendar'
    });
    assert.equal(unauthorized.status,404);
    const bad=await call(0,'/api/projects/'+id+'/intelligence','POST',{refinement:'no'});
    assert.equal(bad.status,400);
    const long=await call(0,'/api/projects/'+id+'/intelligence','POST',{refinement:'a'.repeat(451)});
    assert.equal(long.status,400);
    const update=await call(0,'/api/projects/'+id+'/intelligence','POST',{
      refinement:'Keep existing assignments and calendar, remove messaging. Prioritize accessible mobile.'
    });
    assert.equal(update.status,200);
    assert.equal(update.body.project.brief,brief,'The original user brief must remain unchanged');
    assert.ok(update.body.project.recommendations.analysis.excludedFeatures.some(f=>f.id==='messages'));
    assert.ok(!update.body.project.recommendations.analysis.features.some(f=>f.id==='messages'));
    assert.equal(update.body.project.recommendations.decision.version,2);
    assert.equal(update.body.project.recommendations.refinement.startsWith('Keep existing'),true);
    const fetched=await call(0,'/api/projects/'+id);
    assert.equal(fetched.status,200);
    assert.equal(fetched.body.project.recommendations.refinement,update.body.project.recommendations.refinement);
    assert.deepEqual(fetched.body.project.messages,sent.body.messages,'Chat and timestamps must survive refinement');
    const exported=await call(0,'/api/projects/'+id+'/export','POST',{styles:['minimal']});
    assert.equal(exported.status,200);
    assert.match(exported.body.prompt,/EXPLICITLY OUT OF SCOPE/);
    assert.match(exported.body.prompt,/Messages and conversations/);
    const prompt=await call(0,'/api/projects/'+id+'/design-prompt','POST',{
      mode:'generate',styles:['minimal']
    });
    assert.equal(prompt.status,200);
    assert.match(prompt.body.prompt,/\[X-messages\]/);
    assert.equal(prompt.body.review.traceability.passed,true);
    const reset=await call(0,'/api/projects/'+id+'/intelligence','POST',{refinement:''});
    assert.equal(reset.status,200);
    assert.equal(reset.body.project.recommendations.refinement,'');
    assert.ok(reset.body.project.recommendations.analysis.features.some(f=>f.id==='messages'),
      'Reset should restore original brief interpretation, not delete original requirements');
    const foreign=await call(1,'/api/projects/'+id);
    assert.equal(foreign.status,404);
  }finally{
    if(cookies[0])await call(0,'/api/profile','DELETE').catch(()=>{});
    if(cookies[1])await call(1,'/api/profile','DELETE').catch(()=>{});
    await new Promise(resolve=>server.close(resolve));
  }
});
