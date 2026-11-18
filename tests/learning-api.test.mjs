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
  }finally{
    await Promise.allSettled([alice('/api/profile','DELETE'),bob('/api/profile','DELETE')]);
    await env.close();
  }
});

test('12: anonymous guests cannot impersonate verified opt-in contributors',async()=>{
  const env=await setup();
  const clients=Array.from({length:12},()=>env.client());
  try{
    for(const call of clients){
      const project=await call('/api/projects','POST',{
        brief:'Build a helpful accessible dashboard for student learning'
      });
      assert.equal(project.status,201);
      const attempted=await call('/api/profile','PUT',{globalOptIn:true});
      assert.equal(attempted.status,403,
        'Anonymous browser cookies must not register as verified community contributors');
      const prefs=await call('/api/profile');
      assert.equal(prefs.data.globalOptIn,false);
      const feedback=await call('/api/feedback','POST',{
        projectId:project.data.project.id,styles:['minimal'],reaction:'like'
      });
      assert.equal(feedback.status,200,'Guest feedback remains private and useful');
    }
    const insights=await clients[0]('/api/insights');
    assert.equal(insights.status,200);
    assert.deepEqual(insights.data.publicPatterns,[],
      'A dozen guest cookies must not become a public statistical cohort');
    assert.equal(insights.data.minimumContributors,10);
    assert.match(insights.data.contributorUnit,/authenticated Google-linked/i);
    assert.match(insights.data.personalizationUsage,/do not automatically steer/i);
  }finally{
    await Promise.allSettled(clients.map(call=>call('/api/profile','DELETE')));
    await env.close();
  }
});

test('12: similar-project feedback is transparent, context-specific, and never shared across visitors',async()=>{
  const env=await setup(),alice=env.client(),bob=env.client();
  const portfolio='Create a creative illustrator portfolio with editorial case studies and project gallery';
  const school='Build a school dashboard for teachers with grades and assignments';
  try{
    const other=await bob('/api/projects','POST',{brief:portfolio});
    assert.equal(other.status,201);
    const baseline=other.data.project.recommendations.designs.find(s=>s.id==='creative').match;
    for(let i=0;i<2;i++){
      const p=await alice('/api/projects','POST',{brief:portfolio});
      assert.equal(p.status,201);
      const voted=await alice('/api/feedback','POST',{
        projectId:p.data.project.id,styles:['creative'],reaction:'like'
      });
      assert.equal(voted.status,200);
    }
    const evidence=await alice('/api/preferences');
    assert.equal(evidence.status,200);
    const portfolioLearning=evidence.data.learning.categories.find(x=>x.category==='Portfolio');
    assert.ok(portfolioLearning);
    assert.equal(portfolioLearning.styles.creative.support,2);
    assert.equal(portfolioLearning.styles.creative.signal,2);
    assert.equal(portfolioLearning.styles.creative.confidence,'low');
    const improved=await alice('/api/projects','POST',{brief:portfolio});
    const option=improved.data.project.recommendations.designs.find(s=>s.id==='creative');
    assert.ok(option.match>=baseline);
    assert.equal(option.personalization.categoryEvidence.adjustment,2,
      'Only context-supported evidence affects similar portfolio projects');
    const different=await alice('/api/projects','POST',{brief:school});
    assert.equal(different.data.project.recommendations.designs.find(s=>s.id==='creative')
      .personalization.categoryEvidence.adjustment,0);
    const isolated=await bob('/api/preferences');
    assert.deepEqual(isolated.data.learning.categories,[]);
    const b=await bob('/api/projects','POST',{brief:portfolio});
    assert.equal(b.data.project.recommendations.designs.find(s=>s.id==='creative')
      .personalization.categoryEvidence.adjustment,0);
    const paused=await alice('/api/preferences','PUT',{enabled:false});
    assert.equal(paused.status,200);
    const noLearning=await alice('/api/projects','POST',{brief:portfolio});
    assert.equal(noLearning.data.project.recommendations.designs.find(s=>s.id==='creative')
      .personalization.categoryEvidence?.adjustment||0,0);
    const clear=await alice('/api/preferences','DELETE');
    assert.equal(clear.status,200);
    assert.deepEqual(clear.data.learning.categories,[]);
    assert.equal((await alice('/api/projects/'+improved.data.project.id)).status,200,
      'Removing learning must not remove saved projects');
  }finally{
    await Promise.allSettled([alice('/api/profile','DELETE'),bob('/api/profile','DELETE')]);
    await env.close();
  }
});
