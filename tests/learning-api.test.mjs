import test from 'node:test';
import assert from 'node:assert/strict';
import {server} from '../server.mjs';

async function setup(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const host='http://127.0.0.1:'+server.address().port;
  const client=()=>{
    let cookie='';
    return async(path,method='GET',data)=>{
      const headers={};
      if(cookie)headers.Cookie=cookie;
      if(data!==undefined)headers['Content-Type']='application/json';
      const r=await fetch(host+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data)});
      cookie=r.headers.get('set-cookie')?.split(';')[0]||cookie;
      return {status:r.status,data:await r.json()};
    };
  };
  return {client,close:()=>new Promise(resolve=>server.close(resolve))};
}
test('Milestone 07 guest feedback is private, editable, pausable and deletable without deleting projects',async()=>{
  const env=await setup(),alice=env.client(),bob=env.client();
  try{
    const brief='Create a general web platform for team collaboration, document sharing and messaging';
    const a=await alice('/api/projects','POST',{brief});
    const b=await bob('/api/projects','POST',{brief});
    assert.equal(a.status,201);assert.equal(b.status,201);
    const initialB=await bob('/api/projects/'+b.data.project.id);
    const initialScore=initialB.data.project.recommendations.designs.find(x=>x.id==='creative').match;
    const id=a.data.project.id;
    for(let i=0;i<3;i++){
      const result=await alice('/api/feedback','POST',{projectId:id,styles:['creative'],reaction:'like',detail:'Distinctive visuals'});
      assert.equal(result.status,200);
      assert.equal(result.data.changed,i===0?1:0,'Repeated identical feedback must not inflate learning');
    }
    const learned=await alice('/api/preferences');
    assert.equal(learned.status,200);
    assert.equal(learned.data.profile.styleWeights.creative,1);
    assert.equal(learned.data.evidence.find(x=>x.style==='creative').likes,1);
    const isolated=await bob('/api/preferences');
    assert.equal(isolated.data.profile.styleWeights.creative,undefined,'Visitors do not share learned preferences');
    assert.equal(isolated.data.evidence.find(x=>x.style==='creative').likes,0);
    const newA=await alice('/api/projects','POST',{brief});
    const personalized=newA.data.project.recommendations.designs.find(x=>x.id==='creative').match;
    assert.ok(personalized>initialScore,'New projects consider explicit private feedback');
    const dislike=await alice('/api/feedback','POST',{
      projectId:id,styles:['creative'],reaction:'dislike',detail:'Too much decoration'
    });
    assert.equal(dislike.status,200);
    assert.equal(dislike.data.changed,1);
    assert.equal(dislike.data.profile.styleWeights.creative,-1,
      'Switching from like to dislike must reverse the earlier +1 signal');
    const reversedEvidence=await alice('/api/preferences');
    assert.equal(reversedEvidence.data.evidence.find(x=>x.style==='creative').likes,0);
    assert.equal(reversedEvidence.data.evidence.find(x=>x.style==='creative').dislikes,1);
    const afterDislike=await alice('/api/projects','POST',{brief});
    assert.ok(afterDislike.data.project.recommendations.designs.find(x=>x.id==='creative').match<initialScore,
      'Negative preference should influence later unrelated projects');
    const updated=await alice('/api/preferences','PUT',{
      motion:'minimal',density:'compact',contrast:'high',colorMood:'warm',
      styleWeights:{creative:-3,minimal:3}
    });
    assert.equal(updated.status,200);
    assert.equal(updated.data.profile.styleWeights.creative,-3);
    assert.equal(updated.data.profile.personalization.motion,'minimal');
    assert.equal(updated.data.profile.personalization.colorMood,'warm');
    const paused=await alice('/api/preferences','PUT',{enabled:false});
    assert.equal(paused.data.profile.personalization.enabled,false);
    assert.equal(paused.data.profile.globalOptIn,false);
    const blocked=await alice('/api/feedback','POST',{projectId:id,styles:['minimal'],reaction:'like'});
    assert.equal(blocked.status,409,'Paused learning cannot silently store feedback');
    const prompt=await alice('/api/projects/'+id+'/design-prompt','POST',{mode:'fusion',styles:['glass','minimal']});
    assert.equal(prompt.status,200);assert.match(prompt.data.prompt,/No stored personal preferences are active/);
    const pausedNew=await alice('/api/projects','POST',{brief});
    const pausedScore=pausedNew.data.project.recommendations.designs.find(x=>x.id==='creative').match;
    assert.equal(pausedScore,initialScore,'Paused memory cannot silently bias recommendations');
    const corrections=await alice('/api/preferences','PUT',{styleWeights:{glass:22}});
    assert.equal(corrections.status,400);
    const wipe=await alice('/api/preferences','DELETE');
    assert.equal(wipe.status,200);
    assert.equal(wipe.data.evidence.find(x=>x.style==='creative').likes,0);
    assert.deepEqual(wipe.data.profile.styleWeights,{});
    const existing=await alice('/api/projects/'+id);
    assert.equal(existing.status,200,'Clearing preferences must not delete existing projects');
    assert.equal(existing.data.project.brief,brief);
    assert.equal((await bob('/api/projects/'+id)).status,404);
  }finally{await env.close();}
});
test('Aggregated learning requires five distinct opted-in contributors and honors revoked consent',async()=>{
  const env=await setup();
  try{
    const clients=Array.from({length:5},()=>env.client());
    for(let i=0;i<clients.length;i++){
      const call=clients[i];
      const project=await call('/api/projects','POST',{brief:'Create a modern team productivity dashboard for work'});
      assert.equal(project.status,201);
      const opted=await call('/api/profile','PUT',{globalOptIn:true});
      assert.equal(opted.data.globalOptIn,true);
      const saved=await call('/api/feedback','POST',{projectId:project.data.project.id,styles:['minimal'],reaction:'like'});
      assert.equal(saved.status,200);
      const aggregate=await call('/api/insights');
      assert.equal(aggregate.status,200);
      if(i<4)assert.equal(aggregate.data.publicPatterns.length,0,'Never publish a cohort below five');
      else assert.ok(aggregate.data.publicPatterns.some(x=>x.style==='minimal'&&x.contributorsBand==='5–9'));
      assert.equal(aggregate.data.contributorUnit,'distinct guest visitor IDs, not verified people');
      assert.ok(aggregate.data.publicPatterns.every(x=>x.people===undefined),
        'Public insights must not expose exact small guest cohort sizes');
    }
    const revoke=await clients[0]('/api/profile','PUT',{globalOptIn:false});
    assert.equal(revoke.data.globalOptIn,false);
    const after=await clients[1]('/api/insights');
    assert.equal(after.data.publicPatterns.length,0,'Prior eligible feedback must be excluded after opting out');
  }finally{await env.close();}
});


test('One guest with many projects is never treated as five independent contributors',async()=>{
  const env=await setup(),call=env.client();
  try{
    const opted=await call('/api/profile','PUT',{globalOptIn:true});
    assert.equal(opted.data.globalOptIn,true);
    for(let i=0;i<6;i++){
      const project=await call('/api/projects','POST',{
        brief:'Create an accessible task workspace for an education portal '+i
      });
      assert.equal(project.status,201);
      const vote=await call('/api/feedback','POST',{
        projectId:project.data.project.id,styles:['minimal'],reaction:'like'
      });
      assert.equal(vote.status,200);
    }
    assert.deepEqual((await call('/api/insights')).data.publicPatterns,[],
      'A single guest cookie cannot independently meet the minimum cohort');
  }finally{await env.close();}
});

test('Current shared cohort reflects latest reaction, not a past like',async()=>{
  const env=await setup();
  try{
    const clients=Array.from({length:5},()=>env.client()),ids=[];
    for(const call of clients){
      const created=await call('/api/projects','POST',{brief:'Design a simple education dashboard with accessible assignments'});
      ids.push(created.data.project.id);
      await call('/api/profile','PUT',{globalOptIn:true});
      await call('/api/feedback','POST',{projectId:created.data.project.id,styles:['minimal'],reaction:'like'});
    }
    assert.equal((await clients[0]('/api/insights')).data.publicPatterns[0].contributorsBand,'5–9');
    const reverse=await clients[0]('/api/feedback','POST',{
      projectId:ids[0],styles:['minimal'],reaction:'dislike',detail:'Changed my mind'
    });
    assert.equal(reverse.status,200);
    assert.equal(reverse.data.profile.styleWeights.minimal,-1);
    assert.deepEqual((await clients[1]('/api/insights')).data.publicPatterns,[],
      'A previously liked style must not remain eligible after feedback reversal');
    await clients[0]('/api/feedback','POST',{
      projectId:ids[0],styles:['minimal'],reaction:'like',detail:'I prefer it now'
    });
    assert.equal((await clients[1]('/api/insights')).data.publicPatterns[0].contributorsBand,'5–9');
  }finally{await env.close();}
});
