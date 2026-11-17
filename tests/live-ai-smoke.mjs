/**
 * One-time, opt-in live AI smoke test. Requires AI_LIVE_CHECK=1 and makes exactly
 * one synthetic chat request against the PUBLIC Frontline app. Uses a fresh guest
 * cookie and deletes only that synthetic guest's workspace in finally.
 * Never reads secrets or prints model content/private response data.
 */
const target=process.env.AI_LIVE_CHECK==='1'
  ?'https://ui-compass-studio.onrender.com':null;
if(!target){
  console.log('Live AI probe disabled (set AI_LIVE_CHECK=1 for a deliberate run).');
  process.exit(0);
}
const prompt='Design a fictional lighthouse visitors center with a tide forecast, accessible exhibits, wayfinding and marine-life information. Recommend an original responsive UI direction.';
let cookie='';
let project='';
const headers=()=>cookie?{Cookie:cookie}:{};
async function request(path,method='GET',payload){
  const response=await fetch(target+path,{
    method,
    headers:{...headers(),...(payload?{'Content-Type':'application/json'}:{})},
    body:payload?JSON.stringify(payload):undefined,
    signal:AbortSignal.timeout(100000)
  });
  const setCookie=response.headers.get('set-cookie');
  if(setCookie&&!cookie)cookie=setCookie.split(';')[0];
  const body=await response.json();
  return {code:response.status,body};
}
try{
  const created=await request('/api/projects','POST',{brief:prompt});
  if(created.code!==201||!created.body.project?.id)throw Error('Synthetic project create HTTP '+created.code);
  project=created.body.project.id;
  const chat=await request('/api/projects/'+encodeURIComponent(project)+'/messages','POST',{
    message:'For this fictional project, explain navigation and accessibility.',
    styles:['minimal','glass'],
  });
  if(chat.code!==200)throw Error('Synthetic chat HTTP '+chat.code);
  const reply=chat.body.answer||{};
  const source=['ai','guide','error'].includes(reply.source)?reply.source:'unknown';
  const provider=['gemini','openrouter'].includes(reply.provider)?reply.provider:'none';
  console.log('LIVE_AI_SMOKE source='+source+' provider='+provider+' (fictional project; no answer text logged)');
  if(source!=='ai')console.log('LIVE_AI_SMOKE AI service still returned deterministic fallback; check Render provider diagnostics.');
}catch(error){
  // No upstream body, response headers, request payload or secret values logged.
  console.log('LIVE_AI_SMOKE request failed: '+(error?.name==='TimeoutError'?'timeout':'HTTP or transport'));
}finally{
  if(cookie){
    try{
      const deleted=await request('/api/profile','DELETE');
      console.log('LIVE_AI_SMOKE synthetic guest cleanup: '+(deleted.code===200?'complete':'failed'));
    }catch{
      console.log('LIVE_AI_SMOKE synthetic guest cleanup: failed');
    }
  }
}
