/**
 * Real-provider baseline smoke test, intentionally NOT mocked.
 *
 * This checks the public deployed revision, not the un-deployed PR candidate.
 * A separate staging release of the candidate is required for final sign-off.
 *
 * Uses a disposable fictional guest, no credentials, and deletes all its
 * private project/chat data in finally. Emits bounded QA result codes only.
 */
const ORIGIN=process.env.FRONTLINE_LIVE_TARGET||'https://ui-compass-studio.onrender.com';
if(process.env.LIVE_ACCEPTANCE!=='1')throw Error('Explicit LIVE_ACCEPTANCE=1 required');
if(!/^https:\/\/[a-z0-9.-]+(?:\.onrender\.com)?$/.test(ORIGIN))
  throw Error('Invalid live acceptance target');
const brief='Build an accessible community makerspace booking and tool-maintenance system for library patrons and workshop coordinators. '+
  'Visitors need to find available equipment, reserve time slots, review safety instructions and report broken tools. '+
  'Staff need inspection checklists, repair queues and a shared calendar. '+
  'The public landing page should explain the makerspace, show upcoming workshops and help new members register.';
const stageStats=[];
let cookie='',projectId='',revision='';
const fail=(code)=>{throw new Error(code)};
function check(value,code){if(!value)fail(code)}
function note(stage,outcome){stageStats.push(stage+':'+outcome);console.log('LIVE_ACCEPTANCE '+stage+'='+outcome)}
const request=async(path,method='GET',payload,timeout=100000)=>{
  const response=await fetch(ORIGIN+path,{
    method,headers:{...(cookie?{Cookie:cookie}:{}),
      ...(payload?{'Content-Type':'application/json'}:{})},
    body:payload?JSON.stringify(payload):undefined,
    signal:AbortSignal.timeout(timeout)
  });
  const fresh=response.headers.get('set-cookie');
  if(fresh&&!cookie)cookie=fresh.split(';')[0];
  const body=await response.json();
  return {status:response.status,body};
};
const sourceURLs=text=>[...String(text||'').matchAll(/https:\/\/(?:screenrove\.com|kage\.design)\/[a-z0-9/_?=&.-]+/gi)]
  .map(x=>x[0]).sort();
let good=false;
try{
  const health=await request('/api/health');
  check(health.status===200&&health.body.status==='ok'&&health.body.database==='connected','unhealthy-database');
  revision=String(health.body.revision||'').slice(0,12);
  check(/^[a-f0-9]{12}$/.test(revision),'unverified-live-revision');
  note('production-revision',revision);
  const config=await request('/api/config');
  check(config.status===200&&config.body.aiPrimary==='groq'&&
    config.body.aiProviders?.groq===true&&config.body.aiFallbackEnabled===false,
    'groq-only-primary-not-active');
  note('live-ai-provider','configured-groq-only');
  const created=await request('/api/projects','POST',{brief});
  check(created.status===201&&/^[a-f0-9-]{36}$/.test(created.body?.project?.id||''),'cannot-create-disposable-project');
  projectId=created.body.project.id;
  note('disposable-project','created');
  const route='/api/projects/'+projectId+'/messages';
  const first=await request(route,'POST',{message:brief,styles:[],simpleDiscovery:true},120000);
  check(first.status===200,'first-recommendation-http-error');
  const previous=first.body.answer;
  check(previous?.flowStage==='offer-combination','first-recommendation-wrong-stage');
  const firstText=String(previous.content||'');
  check(firstText.includes('Reply **Yes** or **No**'),'consent-question-missing');
  check(!/Something went wrong|Request failed/i.test(firstText),'first-recommendation-crashed');
  const snapshot=previous?.sourceSnapshot;
  check(snapshot&&Array.isArray(snapshot.applicationMatches)&&
    Array.isArray(snapshot.landingMatches),'first-source-snapshot-missing');
  note('first-recommendation','http-ok-and-snapshot');
  // A heuristic fallback or absent AI proof must not be misrepresented as
  // a successful semantic AI recommendation.
  const degraded=/AI relevance checking was temporarily unavailable|temporarily unavailable.*publisher-metadata/i.test(firstText);
  const reviewStatus=String(previous.quality?.sourceReview||'unreported');
  note('ai-review-mode',degraded?'degraded':reviewStatus);
  const firstLinks=sourceURLs(firstText);
  const snapLinks=[...snapshot.applicationMatches,...snapshot.landingMatches]
    .map(x=>x.site).sort();
  check(JSON.stringify(firstLinks)===JSON.stringify(snapLinks),
    'first-publisher-links-mismatch');
  check(snapLinks.every(url=>/^https:\/\/(?:screenrove\.com|kage\.design)\//.test(url)),
    'untrusted-publisher-link');
  check(!snapLinks.some(url=>/\/404(?:[/-]|$)|not-found|error-page/i.test(url)),
    'error-page-recommended');
  note('original-links',String(snapLinks.length));
  const yes=await request(route,'POST',{message:'Yes',styles:[],simpleDiscovery:true},120000);
  check(yes.status===200,'yes-http-error');
  const answer=String(yes.body.answer?.content||'');
  check(answer.includes('Matching components and animations'),'yes-components-section-missing');
  check(!/Something went wrong|Request failed/i.test(answer),'yes-crashed');
  const after=sourceURLs(answer);
  check(JSON.stringify(after)===JSON.stringify(snapLinks),'yes-replaced-original-sources');
  const componentLinks=[...answer.matchAll(/https:\/\/(?:reactbits\.dev|ui\.aceternity\.com)\/[a-z0-9/.-]+/g)]
    .map(m=>m[0]);
  note('yes-preserved-links',String(after.length));
  note('official-component-links',String(componentLinks.length));
  const saved=await request('/api/projects/'+projectId);
  check(saved.status===200&&saved.body.project?.brief===brief,'saved-brief-mismatch');
  check(saved.body.project?.messages?.length===4,'messages-not-persisted');
  note('chat-persistence','passed');
  // An unavailable live model is a meaningful release blocker: the current
  // public flow must not be certified as fully AI-verified in this case.
  check(!degraded,'semantic-ai-unavailable');
  check(reviewStatus==='semantic-evaluated','semantic-ai-not-proven-by-api');
  check(componentLinks.length>0,'no-verified-components-in-live-sample');
  // A source-empty result isn't automatically fabricated, but cannot prove
  // working publisher coverage on this intentionally broad, common UI task.
  check(snapLinks.length>0,'no-verified-design-sources-in-live-sample');
  good=true;note('baseline','passed');
}catch(error){
  const code=/^[a-z][a-z0-9-]{1,64}$/.test(error?.message||'')?
    error.message:error?.name==='TimeoutError'?'provider-timeout':'transport-or-runtime-error';
  note('baseline','FAILED-'+code);
  process.exitCode=1;
}finally{
  if(cookie){
    try{
      const removed=await request('/api/profile','DELETE',undefined,30000);
      if(removed.status!==200||removed.body.deleted!==true)throw Error('bad-delete');
      note('guest-data-cleanup','passed');
    }catch{
      note('guest-data-cleanup','FAILED');
      process.exitCode=1;
    }
  }
  console.log('LIVE_ACCEPTANCE_SUMMARY revision='+revision+' passed='+good+
    ' stages='+stageStats.length+' intentionally_no_publisher_prompts_logged=true');
}
