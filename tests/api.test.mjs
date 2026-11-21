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
    assert.equal(chat.data.answer.source,'guide','Test mode must not make real OpenRouter calls');
    assert.match(chat.data.answer.text,/## Project understanding/);
    assert.match(chat.data.answer.text,/## Recommended UI\/UX direction/);
    assert.match(chat.data.answer.text,/Retry with OpenRouter/);
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


test('new and reopened projects expose all requested features without rewriting saved data',async()=>{
  const env=await getEnvironment();const {call}=env;
  try{
    const brief='Create a student teacher dashboard for administrators, with assignment tracking, an AI tutor, calendar, notification center, student profile, course progress and accessible mobile design.';
    const created=await call(0,'/api/projects','POST',{brief});
    assert.equal(created.status,201);
    const id=created.data.project.id;
    const first=created.data.project.recommendations.analysis;
    assert.ok(first.features.some(x=>x.id==='notifications'));
    assert.ok(first.features.some(x=>x.id==='profile'));
    assert.ok(first.audience.includes('Administrators'));
    const loaded=await call(0,'/api/projects/'+id);
    assert.equal(loaded.status,200);
    const refreshed=loaded.data.project.recommendations.analysis;
    assert.deepEqual(refreshed.features,first.features);
    assert.equal(loaded.data.project.brief,brief);
    assert.equal(new Set(refreshed.pages).size,refreshed.pages.length);
    assert.ok(!refreshed.pages.includes('Courses and assignments'));
    const after=await call(0,'/api/projects/'+id);
    assert.equal(after.data.project.brief,brief);
    assert.deepEqual(after.data.project.messages,[]);
    const deleted=await call(0,'/api/profile','DELETE');assert.equal(deleted.data.deleted,true);
  }finally{await env.close();}
});


test('Cookie-bound API writes reject cross-origin and non-JSON form submissions',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const brief='Create an accessible education dashboard with courses and assignments';
  try{
    const visitor=await fetch(base+'/api/profile');
    const cookie=visitor.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie,'Guest should have an HttpOnly visitor cookie');
    const cross=await fetch(base+'/api/projects',{method:'POST',
      headers:{Cookie:cookie,'Content-Type':'application/json',Origin:'https://attacker.example'},
      body:JSON.stringify({brief})});
    assert.equal(cross.status,403,'Do not accept cross-origin cookie writes');
    const form=await fetch(base+'/api/projects',{method:'POST',
      headers:{Cookie:cookie,'Content-Type':'text/plain'},
      body:JSON.stringify({brief})});
    assert.equal(form.status,415,'A simple cross-site HTML form must not create a project');
    const okay=await fetch(base+'/api/projects',{method:'POST',
      headers:{Cookie:cookie,'Content-Type':'application/json',Origin:base},
      body:JSON.stringify({brief})});
    assert.equal(okay.status,201,'A real same-origin JSON request must continue working');
    const projects=await fetch(base+'/api/projects',{headers:{Cookie:cookie}});
    assert.equal((await projects.json()).projects.length,1);
    const cleanup=await fetch(base+'/api/profile',{method:'DELETE',headers:{Cookie:cookie,Origin:base}});
    assert.equal(cleanup.status,200);
  }finally{await new Promise(resolve=>server.close(resolve))}
});

test('malformed guest cookie never crashes the HTTP server or leaks another visitor workspace',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    for(const header of ['uic_guest=%ZZ','uic_guest=%E0%A4%A',
      'uic_guest=wrong-format; Other=abc','uic_guest='+('A'.repeat(40))]){
      const response=await fetch(base+'/api/profile',{headers:{Cookie:header}});
      assert.equal(response.status,200);
      const assigned=response.headers.get('set-cookie')||'';
      assert.match(assigned,/uic_guest=[a-f0-9-]{36}/);
    }
    const alive=await fetch(base+'/api/health');
    assert.equal((await alive.json()).status,'ok','Malformed headers must not kill the Node process');
  }finally{await new Promise(resolve=>server.close(resolve))}
});
test('chat history preserves more than 24 turns, and reaches an explicit safe cap without deletion',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  let cookie='';
  const call=async(path,method='GET',body)=>{
    const response=await fetch(base+path,{method,headers:{
      ...(cookie?{Cookie:cookie}:{}),
      ...(body?{'Content-Type':'application/json'}:{})
    },body:body?JSON.stringify(body):undefined});
    cookie=response.headers.get('set-cookie')?.split(';')[0]||cookie;
    return {status:response.status,body:await response.json()};
  };
  try{
    const project=await call('/api/projects','POST',{
      brief:'Create an accessible classroom dashboard for project and assignment tracking.'});
    assert.equal(project.status,201);
    const id=project.body.project.id,route='/api/projects/'+id+'/messages';
    for(let i=0;i<14;i++){
      const r=await call(route,'POST',{message:'Explain dashboard section '+i,styles:[]});
      assert.equal(r.status,200);
    }
    const persisted=await call('/api/projects/'+id);
    assert.equal(persisted.body.project.messages.length,28,
      'Previously the oldest messages disappeared after the 13th request');
    assert.equal(persisted.body.project.messages[0].content,'Explain dashboard section 0');
  }finally{await new Promise(resolve=>server.close(resolve))}
});
test('simultaneous writes to the same conversation never silently overwrite a saved reply',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  let cookie='';
  try{
    const created=await fetch(base+'/api/projects',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({brief:'Design a teacher scheduling dashboard with accessible navigation.'})});
    cookie=created.headers.get('set-cookie').split(';')[0];
    const id=(await created.json()).project.id;
    const path=base+'/api/projects/'+id+'/messages';
    const send=message=>fetch(path,{method:'POST',headers:{
      Cookie:cookie,'Content-Type':'application/json'},
      body:JSON.stringify({message,styles:[]})});
    const [first,second]=await Promise.all([send('First concurrent dashboard request'),
      send('Second concurrent dashboard request')]);
    assert.deepEqual([first.status,second.status].sort(),[200,409],
      'One concurrent request must receive a retryable conflict instead of erasing another reply');
    const saved=await fetch(base+'/api/projects/'+id,{headers:{Cookie:cookie}});
    const body=(await saved.json()).project.messages;
    assert.equal(body.length,2);
    assert.ok(['First concurrent dashboard request','Second concurrent dashboard request'].includes(body[0].content));
  }finally{await new Promise(resolve=>server.close(resolve))}
});
