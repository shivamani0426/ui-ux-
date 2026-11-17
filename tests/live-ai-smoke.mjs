/**
 * One-time production AI check. Uses fictional design briefs, a fresh anonymous
 * guest cookie and deletion in finally. NEVER log provider text or credentials.
 * AI_LIVE_CHECK=1 explicitly opts into 2 real OpenRouter requests.
 */
const target=process.env.AI_LIVE_CHECK==='1'?'https://ui-compass-studio.onrender.com':null;
if(!target){
  console.log('LIVE_AI_SMOKE skipped: no explicit opt-in.');
  process.exit(0);
}
let cookie='';
let projectId='';
let cleanupAttempted=false;
const headers=()=>cookie?{Cookie:cookie}:{};
async function call(path,method='GET',payload){
  const response=await fetch(target+path,{
    method,
    headers:{...headers(),...(payload?{'Content-Type':'application/json'}:{})},
    body:payload?JSON.stringify(payload):undefined,
    signal:AbortSignal.timeout(100000),
  });
  const received=response.headers.get('set-cookie');
  if(received&&!cookie)cookie=received.split(';')[0];
  return {status:response.status,data:await response.json()};
}
function check(ok,code){if(!ok)throw Error(code)}
async function run(){
  const config=await call('/api/config');
  check(config.status===200,'config-http');
  check(config.data?.aiPrimary==='openrouter','wrong-primary');
  check(config.data?.aiProviders?.openrouter===true,'openrouter-not-configured');
  check(config.data?.aiFallbackEnabled===false,'unexpected-provider-fallback');
  const health=await call('/api/health');
  check(health.status===200&&health.data?.database==='connected','database-not-connected');
  if(process.env.EXPECTED_COMMIT_SHA){
    check(health.data?.revision===process.env.EXPECTED_COMMIT_SHA.slice(0,12),'wrong-production-revision');
  }
  const created=await call('/api/projects','POST',{
    brief:'Design a fictional seaside learning museum with an accessibility map and exhibits.',
  });
  check(created.status===201&&typeof created.data?.project?.id==='string','project-create-failed');
  projectId=created.data.project.id;
  const questions=[
    'For this fictional museum, recommend a clear mobile navigation layout.',
    'Suggest an original accessible color palette and page hierarchy for the same museum.',
  ];
  for(let i=0;i<questions.length;i++){
    const result=await call('/api/projects/'+encodeURIComponent(projectId)+'/messages','POST',{
      message:questions[i],styles:['minimal','glass'],
    });
    check(result.status===200,'chat-http-'+(i+1));
    const answer=result.data?.answer;
    const source=answer?.source==='ai'?'ai':answer?.source==='guide'?'guide':'unknown';
    const provider=answer?.provider==='openrouter'?'openrouter':'none';
    console.log('LIVE_AI_SMOKE step='+(i+1)+' source='+source+' provider='+provider);
    check(source==='ai'&&provider==='openrouter'&&typeof answer.text==='string'&&answer.text.trim().length>=20,'ai-not-delivered-'+(i+1));
  }
  const saved=await call('/api/projects/'+encodeURIComponent(projectId));
  check(saved.status===200&&saved.data?.project?.messages?.length===4,'chat-not-persisted');
  console.log('LIVE_AI_SMOKE two real OpenRouter replies received and chat persisted');
}
try{
  await run();
}catch(error){
  // Only fixed error codes from this test are logged. No response bodies or secrets.
  const code=/^[a-z0-9-]{3,50}$/.test(error?.message||'')?error.message:
    error?.name==='TimeoutError'?'timeout':'transport-or-json';
  console.error('LIVE_AI_SMOKE FAILED code='+code);
  process.exitCode=1;
}finally{
  if(cookie){
    cleanupAttempted=true;
    try{
      const removed=await call('/api/profile','DELETE');
      if(removed.status!==200||removed.data?.deleted!==true)throw Error('cleanup-status');
      console.log('LIVE_AI_SMOKE synthetic guest cleanup=complete');
    }catch{
      console.error('LIVE_AI_SMOKE synthetic guest cleanup=failed');
      process.exitCode=1;
    }
  }
  if(!cleanupAttempted&&projectId){
    console.error('LIVE_AI_SMOKE synthetic guest cleanup=not-attempted');
    process.exitCode=1;
  }
}
