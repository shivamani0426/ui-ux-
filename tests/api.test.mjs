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
    const created=await call(0,'/api/projects','POST',{brief:'Design a modern AI student learning portal with a dashboard and smooth transitions.'});
    assert.equal(created.status,201);
    const id=created.data.project.id;
    assert.equal(created.data.project.recommendations.designs.length,3);
    const other=await call(1,`/api/projects/${id}`);assert.equal(other.status,404);
    const selection=['minimal','glass','creative'];
    const feedback=await call(0,'/api/feedback','POST',{projectId:id,styles:selection,reaction:'like',detail:'Love all three'});
    assert.equal(feedback.status,200);assert.equal(feedback.data.saved,3);
    for(const s of selection)assert.equal(feedback.data.profile.styleWeights[s],1);
    const list=await call(0,'/api/projects');assert.equal(list.data.projects.length,1);
    const chat=await call(0,`/api/projects/${id}/messages`,'POST',{message:'Plan the pages',styles:selection});
    assert.equal(chat.status,200);assert.equal(chat.data.messages.length,2);
    const after=await call(0,`/api/projects/${id}`);assert.equal(after.data.project.messages.length,2);
    const exportRes=await call(0,`/api/projects/${id}/export`,'POST',{styles:selection});
    assert.equal(exportRes.status,200);assert.ok(exportRes.data.prompt.includes('Glass UI'));
    const invalid=await call(0,'/api/feedback','POST',{projectId:id,styles:['unknown'],reaction:'like'});
    assert.equal(invalid.status,400);
    const erase=await call(0,'/api/profile','DELETE');assert.equal(erase.data.deleted,true);
    const erased=await call(0,'/api/projects');assert.equal(erased.data.projects.length,0);
  }finally{await env.close();}
});
