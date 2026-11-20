/**
 * Staging acceptance for the UNDEPLOYED branch against real official publisher
 * APIs + disposable PostgreSQL. It uses no AI credentials and tests the honest
 * non-AI fallback, not semantic-model accuracy. Do not call this AI validation.
 */
const TARGET=process.env.STAGING_TARGET||'http://127.0.0.1:3019';
const REQUIRE_REAL_AI=process.env.STAGING_REQUIRE_SEMANTIC_AI==='1';
if(!/^http:\/\/127\.0\.0\.1:[0-9]{2,5}$/.test(TARGET))
  throw Error('Staging target must be local isolated server');
const brief='Create an equipment reservation and maintenance workspace for a neighborhood learning center. '+
  'Members book shared resources from a calendar, reserve available time slots and inspect equipment before use. '+
  'Coordinators manage inventory, maintenance requests and activity records. '+
  'Provide a public service landing page explaining how to reserve equipment and attend classes.';
let cookie='';
const say=(k,v)=>console.log('STAGING_ACCEPTANCE '+k+'='+v);
const get=async(path,method='GET',data)=>{
  const res=await fetch(TARGET+path,{method,headers:{
    ...(cookie?{Cookie:cookie}:{}),
    ...(data?{'Content-Type':'application/json'}:{})
  },body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(120000)});
  if(!cookie&&res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];
  return {code:res.status,data:await res.json()};
};
const linksOf=body=>([...String(body).matchAll(/https:\/\/(?:screenrove\.com|kage\.design)\/[a-z0-9/_?=&.-]+/gi)]
  .map(m=>m[0]).sort());
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const assert=(x,code)=>{if(!x)throw Error(code)};
try{
  const health=await get('/api/health');
  assert(health.code===200&&health.data.database==='connected','staging-db-health');
  const config=await get('/api/config');
  assert(config.code===200&&config.data.aiEnabled===REQUIRE_REAL_AI,
    REQUIRE_REAL_AI?'staging-real-ai-not-configured':'staging-must-not-use-real-model');
  say('database','connected');
  const created=await get('/api/projects','POST',{brief});
  assert(created.code===201,'staging-project-creation');
  const id=created.data.project.id;
  const route='/api/projects/'+id+'/messages';
  const first=await get(route,'POST',{message:brief,styles:[],simpleDiscovery:true});
  assert(first.code===200,'staging-first-http');
  const source=first.data.answer;
  assert(source?.flowStage==='offer-combination','staging-first-stage');
  if(REQUIRE_REAL_AI){
    assert(source.quality?.sourceReview==='semantic-evaluated','staging-semantic-ai-not-proven');
  }else{
    assert(source.quality?.sourceReview==='metadata-fallback'||
      source.quality?.sourceReview==='no-verified-candidates',
      'staging-review-status-not-honest');
  }
  const links=linksOf(source.content);
  const snapshot=source.sourceSnapshot;
  assert(snapshot,'staging-missing-source-snapshot');
  const persisted=[...snapshot.applicationMatches,...snapshot.landingMatches].map(x=>x.site).sort();
  assert(equal(links,persisted),'staging-first-link-inconsistency');
  assert(!persisted.some(x=>/404|not-found|error-page/i.test(x)),'staging-broken-page');
  say('publisher-links',String(links.length));
  say('source-review',source.quality.sourceReview);
  say('model-mode',REQUIRE_REAL_AI?'live-semantic':'no-model-fallback');
  const yes=await get(route,'POST',{message:'Yes',styles:[],simpleDiscovery:true});
  assert(yes.code===200,'staging-yes-http');
  const after=linksOf(yes.data.answer.content);
  assert(equal(links,after),'staging-yes-replaced-sources');
  const components=[...String(yes.data.answer.content).matchAll(/https:\/\/(?:reactbits\.dev|ui\.aceternity\.com)\/[a-z0-9/.-]+/gi)].map(x=>x[0]);
  say('verified-components',String(components.length));
  assert(components.length>0,'staging-no-verified-components');
  const saved=await get('/api/projects/'+id);
  assert(saved.code===200&&saved.data.project.messages?.length===4,'staging-messages-not-persisted');
  assert(links.length>0,'staging-no-verified-designs-from-real-publishers');
  say('result','passed');
}catch(error){
  const code=/^[a-z][a-z0-9-]{2,65}$/.test(error?.message||'')?error.message:'network-or-runtime';
  say('result','FAILED-'+code);
  process.exitCode=1;
}finally{
  if(cookie){
    try{
      const removed=await get('/api/profile','DELETE');
      if(removed.code!==200||removed.data.deleted!==true)throw Error('delete-failed');
      say('cleanup','passed');
    }catch{say('cleanup','FAILED');process.exitCode=1}
  }
}
