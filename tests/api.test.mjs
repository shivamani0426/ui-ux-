import test from 'node:test';
import assert from 'node:assert/strict';
import {server} from '../server.mjs';

async function getEnvironment(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const host=`http://127.0.0.1:${server.address().port}`;
  const clients=[{},{}];
  async function call(i,path,method='GET',payload){
    const h={};if(payload!==undefined)h['Content-Type']='application/json';if(clients[i].cookie)h.Cookie=clients[i].cookie;
    const response=await fetch(host+path,{method,headers:h,body:payload!==undefined?JSON.stringify(payload):undefined});
    if(response.headers.get('set-cookie'))clients[i].cookie=response.headers.get('set-cookie').split(';')[0];
    const data=await response.json();return {status:response.status,data};
  }
  return {call,close:()=>new Promise(resolve=>server.close(resolve))};
}
test('project creation, all-three feedback, history isolation and deletion',async()=>{
  const env=await getEnvironment();const {call}=env;
  try{
    const health=await call(0,'/api/health');assert.equal(health.data.status,'ok');
    assert.match(health.data.revision,/^(?:[a-f0-9]{12}|local)$/,'Health must publish a safe build revision');
    const created=await call(0,'/api/projects','POST',{brief:'Design a modern AI student learning portal with a dashboard and smooth transitions.'});
    assert.equal(created.status,201);
    const id=created.data.project.id;
    assert.equal(created.data.project.recommendations.designs.length,3);
    assert.equal(created.data.project.recommendations.analysis.category,'Education');
    assert.equal(created.data.project.recommendations.comparison.length,3);
    assert.ok(created.data.project.recommendations.designs.every(d=>d.tradeoff&&d.criteria));
    const other=await call(1,`/api/projects/${id}`);assert.equal(other.status,404);
    const selection=['minimal','glass','creative'];
    const feedback=await call(0,'/api/feedback','POST',{projectId:id,styles:selection,reaction:'like',detail:'Love all three'});
    assert.equal(feedback.status,200);assert.equal(feedback.data.saved,3);
    for(const s of selection)assert.equal(feedback.data.profile.styleWeights[s],1);
    const list=await call(0,'/api/projects');assert.equal(list.data.projects.length,1);
    const chat=await call(0,`/api/projects/${id}/messages`,'POST',{message:'Plan the pages',styles:selection});
    assert.equal(chat.status,200);assert.equal(chat.data.messages.length,2);
    const after=await call(0,`/api/projects/${id}`);assert.equal(after.data.project.messages.length,2);
    const generate=await call(0,`/api/projects/${id}/design-prompt`,'POST',{
      mode:'generate',styles:['minimal'],refinement:'Focus on responsive accessibility'
    });
    assert.equal(generate.status,200);
    assert.equal(generate.data.mode,'generate');
    assert.equal(generate.data.source,'guide','Tests must not contact live AI providers');
    assert.match(generate.data.prompt,/THREE ORIGINAL DESIGN DIRECTIONS/);
    for(const title of ['Minimal SaaS','Glass UI','Creative UI'])assert.ok(generate.data.prompt.includes(title));
    assert.ok(generate.data.prompt.length>1800);
    const generatedAgain=await call(0,`/api/projects/${id}/design-prompt`,'POST',{
      mode:'generate',styles:['minimal']
    });
    assert.equal(generatedAgain.status,200);
    const fusion=await call(0,`/api/projects/${id}/design-prompt`,'POST',{
      mode:'fusion',styles:['minimal','glass'],refinement:'Keep forms readable'
    });
    assert.equal(fusion.status,200);
    assert.match(fusion.data.prompt,/FUSION STRATEGY/);
    assert.match(fusion.data.prompt,/one cohesive result/i);
    const learned=await call(0,'/api/profile');
    assert.equal(learned.data.styleWeights.minimal,3,'Repeated Generate should only learn once');
    assert.equal(learned.data.styleWeights.glass,2);
    assert.equal(learned.data.globalOptIn,false,'Implicit learning must remain private');
    const isolated=await call(1,`/api/projects/${id}/design-prompt`,'POST',{mode:'fusion',styles:selection});
    assert.equal(isolated.status,404,'Another browser must never export private prompts');
    const invalidMode=await call(0,`/api/projects/${id}/design-prompt`,'POST',{mode:'copy',styles:selection});
    assert.equal(invalidMode.status,400);
    const invalidStyle=await call(0,`/api/projects/${id}/design-prompt`,'POST',{mode:'generate',styles:['unknown']});
    assert.equal(invalidStyle.status,400);
    const invalidRefinement=await call(0,`/api/projects/${id}/design-prompt`,'POST',{mode:'fusion',styles:selection,refinement:'x'.repeat(601)});
    assert.equal(invalidRefinement.status,400);
    const exportRes=await call(0,`/api/projects/${id}/export`,'POST',{styles:selection});
    assert.equal(exportRes.status,200);assert.ok(exportRes.data.prompt.includes('Glass UI'));
    const invalid=await call(0,'/api/feedback','POST',{projectId:id,styles:['unknown'],reaction:'like'});
    assert.equal(invalid.status,400);
    const erase=await call(0,'/api/profile','DELETE');assert.equal(erase.data.deleted,true);
    const erased=await call(0,'/api/projects');assert.equal(erased.data.projects.length,0);
  }finally{await env.close();}
});
