/**
 * Verify 07D against actual live PostgreSQL using a disposable fiction-only
 * guest. NEVER call OpenRouter, upload private data, print cookies or leave
 * synthetic records behind. Run only after exact-SHA release gate.
 */
import assert from 'node:assert/strict';
const base='https://ui-compass-studio.onrender.com';
let cookie='',created=false,cleaned=false;
async function call(method,pathname,payload){
  const headers={Origin:base,'Cache-Control':'no-store'};
  if(cookie)headers.Cookie=cookie;
  if(payload!==undefined)headers['Content-Type']='application/json';
  const response=await fetch(base+pathname,{
    method,headers,
    body:payload===undefined?undefined:JSON.stringify(payload),
    signal:AbortSignal.timeout(14000)
  });
  if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
  const data=await response.json();
  return {status:response.status,data};
}
try{
  const initial=await call('GET','/api/profile');
  assert.equal(initial.status,200,'Guest profile read');
  assert.equal(initial.data.globalOptIn,false,'Never enroll synthetic guest in shared learning');
  const project=await call('POST','/api/projects',{
    brief:'Fictional museum volunteer website with simple accessible navigation and visitor exhibit tasks'
  });
  assert.equal(project.status,201,'Disposable project should be created');
  created=true;
  const id=project.data.project?.id;
  assert.match(id,/^[a-f0-9-]{36}$/);
  const first=await call('POST','/api/feedback',{
    projectId:id,styles:['creative'],reaction:'like',detail:'Fictional QA preference'
  });
  assert.equal(first.status,200);
  assert.equal(first.data.changed,1);
  assert.equal(first.data.profile.styleWeights.creative,1);
  const repeat=await call('POST','/api/feedback',{
    projectId:id,styles:['creative'],reaction:'like',detail:'Fictional QA preference'
  });
  assert.equal(repeat.status,200);
  assert.equal(repeat.data.changed,0,'Repeated Like should be idempotent');
  assert.equal(repeat.data.profile.styleWeights.creative,1);
  const reverse=await call('POST','/api/feedback',{
    projectId:id,styles:['creative'],reaction:'dislike',detail:'Fictional changed mind'
  });
  assert.equal(reverse.status,200);
  assert.equal(reverse.data.profile.styleWeights.creative,-1);
  const evidence=await call('GET','/api/preferences');
  assert.equal(evidence.status,200);
  assert.equal(evidence.data.evidence.find(e=>e.style==='creative').likes,0);
  assert.equal(evidence.data.evidence.find(e=>e.style==='creative').dislikes,1);
  const paused=await call('PUT','/api/preferences',{enabled:false});
  assert.equal(paused.status,200);
  const blocked=await call('POST','/api/feedback',{
    projectId:id,styles:['creative'],reaction:'like'
  });
  assert.equal(blocked.status,409,'Paused learning rejects feedback');
  const cleared=await call('DELETE','/api/preferences');
  assert.equal(cleared.status,200);
  assert.deepEqual(cleared.data.profile.styleWeights,{});
  const retained=await call('GET','/api/projects/'+id);
  assert.equal(retained.status,200,'Clearing preferences must not erase projects');
  const deleted=await call('DELETE','/api/profile');
  assert.equal(deleted.status,200);
  cleaned=true;
  console.log('LIVE_LEARNING_SMOKE passed: idempotence, reversal, pause, scoped reset, guest cleanup');
}catch(error){
  console.error('LIVE_LEARNING_SMOKE failed:',error?.name||'Error',String(error?.message||'unknown').slice(0,230));
  process.exitCode=1;
}finally{
  if(created&&!cleaned&&cookie){
    try{
      const response=await call('DELETE','/api/profile');
      cleaned=response.status===200;
    }catch{}
    if(!cleaned){
      console.error('LIVE_LEARNING_SMOKE cleanup failed: check synthetic guest records');
      process.exitCode=1;
    }
  }
}
